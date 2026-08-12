import Foundation
import SwiftUI

@MainActor
final class CoachViewModel: ObservableObject {
    @Published var stones: [Stone] = []
    @Published var history: [Stone] = []
    @Published var turn: StoneSide = .black
    @Published var mode: PlayMode = .local
    @Published var rule: GameRule = .freestyle
    @Published var human: StoneSide = .black
    @Published var setupBrush: StoneSide? = .black
    @Published var depth = 10
    @Published var lines: [EngineLine] = []
    @Published var scores: [EvaluationPoint] = []
    @Published var isThinking = false
    @Published var engineMessage = "点击棋盘开始"
    @Published var showBest = false
    @Published var flipped = false
    @Published var previewLine: EngineLine?
    @Published var previewCount = 0
    @Published var isShowingGameOutcome = false

    private let service = RapfiService()
    private var generation = 0
    private var previewTask: Task<Void, Never>?
    private var reviewTask: Task<Void, Never>?

    var winner: StoneSide? { Self.winner(in: stones) }
    var isDraw: Bool { winner == nil && stones.count >= 225 }
    var gameOutcomeTitle: String { winner.map { "\($0.name)方获胜" } ?? "和棋" }
    var gameOutcomeDetail: String { winner == nil ? "棋盘已满，双方均未形成五连。" : "\(winner!.name)方率先连成五子。" }
    var activePly: Int { stones.count }
    var summaryTitle: String {
        if let winner { return "\(winner.name)方胜" }
        guard let first = lines.first else { return isThinking ? "Rapfi 计算中…" : "等待评分" }
        if first.mateWin || (first.mate ?? 0) > 0 { return "\(turn.name)方胜势" }
        if first.mateLoss || (first.mate ?? 0) < 0 { return "\(turn.opposite.name)方胜势" }
        if first.evaluation == nil, first.winRate == nil { return "Rapfi 开局首选" }
        guard let sideRate = first.winRate else { return "评分已完成" }
        let blackRate = turn == .black ? sideRate : 1 - sideRate
        if blackRate >= 0.9 { return "黑方胜势" }
        if blackRate >= 0.65 { return "黑方优势" }
        if blackRate > 0.53 { return "黑方稍优" }
        if blackRate <= 0.1 { return "白方胜势" }
        if blackRate <= 0.35 { return "白方优势" }
        if blackRate < 0.47 { return "白方稍优" }
        return "局势均衡"
    }

    func place(_ point: BoardPoint) {
        if mode == .setup {
            if let index = stones.firstIndex(where: { $0.x == point.x && $0.y == point.y }) {
                stones.remove(at: index)
            } else if let setupBrush {
                stones.append(Stone(x: point.x, y: point.y, side: setupBrush))
            }
            history = stones
            return
        }
        guard winner == nil, !isDraw else { return }
        guard !stones.contains(where: { $0.x == point.x && $0.y == point.y }) else { return }
        cancelAnalysis()
        stones.append(Stone(x: point.x, y: point.y, side: turn))
        history = stones
        turn = turn.opposite
        previewLine = nil
        previewCount = 0
        if winner != nil || isDraw {
            cancelAnalysis()
            lines = []
            engineMessage = "对局结束"
            isShowingGameOutcome = true
        } else { analyze() }
    }

    func analyze() {
        guard mode != .setup, winner == nil, !isDraw else { return }
        generation += 1
        let request = generation
        let snapshot = stones
        let side = turn
        isThinking = true
        engineMessage = "深度 \(depth) 计算中；仍可继续落子"
        service.analyze(stones: snapshot, side: side, rule: rule, depth: depth, multiPV: 5) { [weak self] result in
            guard let self, self.generation == request else { return }
            self.isThinking = false
            switch result {
            case .success(let resultLines):
                self.lines = resultLines
                let first = resultLines[0]
                self.engineMessage = first.depth > 0 ? "Rapfi 已就绪 · 深度 \(first.depth)" : "Rapfi 开局首选已就绪"
                self.recordScore(line: first, ply: snapshot.count, side: side)
                self.maybeComputerMove()
                self.backfillMissingScore()
            case .failure(let error):
                self.lines = []
                self.engineMessage = error.localizedDescription
            }
        }
    }

    func selectCandidate(_ line: EngineLine) {
        previewTask?.cancel()
        previewLine = line
        previewCount = 0
        let count = previewLength(for: line)
        guard count > 0 else { return }
        previewTask = Task { @MainActor in
            for index in 1...count {
                if Task.isCancelled { return }
                previewCount = index
                try? await Task.sleep(for: .milliseconds(620))
            }
        }
    }

    func playCandidate(_ line: EngineLine) {
        guard let point = line.variation.first else { return }
        place(point)
    }

    func undo() {
        guard !stones.isEmpty else { return }
        cancelAnalysis()
        stones.removeLast()
        turn = stones.count.isMultiple(of: 2) ? .black : .white
        lines = []
        analyze()
    }

    func reset() {
        cancelAnalysis()
        stones = []
        history = []
        scores = []
        lines = []
        turn = .black
        isShowingGameOutcome = false
        engineMessage = "点击棋盘开始"
        analyze()
    }

    func setMode(_ value: PlayMode) {
        mode = value
        cancelAnalysis()
        if value == .setup {
            lines = []
            engineMessage = "摆盘模式：选择黑、白或橡皮"
        } else {
            history = stones
            turn = stones.count.isMultiple(of: 2) ? .black : .white
            analyze()
        }
    }

    func setDepth(_ value: Int) {
        depth = value
        if mode != .setup { cancelAnalysis(); analyze() }
    }

    func go(to ply: Int) {
        let target = max(0, min(ply, history.count))
        cancelAnalysis()
        stones = Array(history.prefix(target))
        turn = target.isMultiple(of: 2) ? .black : .white
        lines = []
        reviewTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(320))
            if !Task.isCancelled { analyze() }
        }
    }

    func finishSetup() {
        history = stones
        mode = .local
        turn = stones.count.isMultiple(of: 2) ? .black : .white
        analyze()
    }

    private func cancelAnalysis() {
        generation += 1
        service.stop()
        isThinking = false
        previewTask?.cancel()
        reviewTask?.cancel()
    }

    private func recordScore(line: EngineLine, ply: Int, side: StoneSide) {
        let forced: StoneSide? = {
            if line.mateWin || (line.mate ?? 0) > 0 { return side }
            if line.mateLoss || (line.mate ?? 0) < 0 { return side.opposite }
            return nil
        }()
        guard line.evaluation != nil || forced != nil else { return }
        let raw = Double(line.evaluation ?? 0)
        let score = side == .black ? raw : -raw
        scores.removeAll { $0.ply == ply }
        scores.append(EvaluationPoint(ply: ply, score: score, forcedWinner: forced, mateIn: line.mate.map(abs)))
        scores.sort { $0.ply < $1.ply }
    }

    private func backfillMissingScore() {
        guard !isThinking, let ply = (0...history.count).first(where: { candidate in
            candidate != stones.count && !scores.contains(where: { $0.ply == candidate })
        }) else { return }
        let snapshot = Array(history.prefix(ply))
        let side: StoneSide = ply.isMultiple(of: 2) ? .black : .white
        let request = generation
        service.analyze(stones: snapshot, side: side, rule: rule, depth: min(10, depth), multiPV: 1) { [weak self] result in
            guard let self, self.generation == request else { return }
            if case .success(let resultLines) = result, let first = resultLines.first {
                self.recordScore(line: first, ply: ply, side: side)
                self.backfillMissingScore()
            }
        }
    }

    private func maybeComputerMove() {
        guard winner == nil, !isDraw, mode == .computer, turn != human, let point = lines.first?.variation.first else { return }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(450))
            if mode == .computer, turn != human { place(point) }
        }
    }

    private func previewLength(for line: EngineLine) -> Int {
        var position = stones
        var side = turn
        var count = 0
        for point in line.variation.prefix(18) {
            guard !position.contains(where: { $0.x == point.x && $0.y == point.y }) else { break }
            position.append(Stone(x: point.x, y: point.y, side: side))
            count += 1
            if Self.winner(in: position) != nil { break }
            side = side.opposite
        }
        return count
    }

    private static func winner(in stones: [Stone]) -> StoneSide? {
        let occupied = Dictionary(uniqueKeysWithValues: stones.map { ("\($0.x)-\($0.y)", $0.side) })
        for stone in stones {
            for (dx, dy) in [(1, 0), (0, 1), (1, 1), (1, -1)] {
                var count = 1
                for sign in [-1, 1] {
                    for step in 1..<5 {
                        if occupied["\(stone.x + dx * step * sign)-\(stone.y + dy * step * sign)"] == stone.side { count += 1 }
                        else { break }
                    }
                }
                if count >= 5 { return stone.side }
            }
        }
        return nil
    }
}
