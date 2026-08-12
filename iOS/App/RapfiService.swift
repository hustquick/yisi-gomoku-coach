import Foundation

final class RapfiService {
    private let queue = DispatchQueue(label: "com.yisi.gomoku.rapfi", qos: .utility)
    private let requestLock = NSLock()
    private var requestGeneration = 0
    private var initialized = false

    func analyze(
        stones: [Stone],
        side: StoneSide,
        rule: GameRule,
        depth: Int,
        multiPV: Int,
        completion: @escaping (Result<[EngineLine], Error>) -> Void
    ) {
        let request = nextRequest()

        // Rapfi's opening expansion is needlessly expensive on an entirely
        // empty board. The center is symmetry-equivalent and is the canonical
        // first move, so return it immediately and keep the engine queue free
        // for the first real position.
        if stones.isEmpty {
            let opening = EngineLine(
                rank: 1, depth: 0, evaluation: nil, mate: nil,
                mateWin: false, mateLoss: false, winRate: nil,
                variation: [BoardPoint(x: 7, y: 7)]
            )
            DispatchQueue.main.async { [weak self] in
                guard self?.isCurrent(request) == true else { return }
                completion(.success([opening]))
            }
            return
        }

        queue.async { [weak self] in
            guard let self, self.isCurrent(request) else { return }
            do {
                try self.initializeIfNeeded()
                guard self.isCurrent(request) else { return }
                let command = self.command(stones: stones, side: side, rule: rule, depth: depth, multiPV: multiPV)
                guard let pointer = command.withCString({ rf_analyze($0) }) else {
                    throw RapfiError.message("Rapfi 没有返回结果")
                }
                let raw = String(cString: pointer)
                if raw.hasPrefix("ERROR:") { throw RapfiError.message(String(raw.dropFirst(6))) }
                let lines = Self.parse(raw)
                guard !lines.isEmpty else { throw RapfiError.message("Rapfi 未返回完整评分") }
                DispatchQueue.main.async { [weak self] in
                    guard self?.isCurrent(request) == true else { return }
                    completion(.success(lines))
                }
            } catch {
                DispatchQueue.main.async { [weak self] in
                    guard self?.isCurrent(request) == true else { return }
                    completion(.failure(error))
                }
            }
        }
    }

    func stop() {
        _ = nextRequest()
        rf_stop()
    }

    private func nextRequest() -> Int {
        requestLock.lock()
        requestGeneration += 1
        let value = requestGeneration
        requestLock.unlock()
        return value
    }

    private func isCurrent(_ request: Int) -> Bool {
        requestLock.lock()
        let current = requestGeneration == request
        requestLock.unlock()
        return current
    }

    private func initializeIfNeeded() throws {
        guard !initialized else { return }
        guard let path = Bundle.main.path(forResource: "config", ofType: "toml") else {
            throw RapfiError.message("安装包中缺少 Rapfi 配置")
        }
        guard let pointer = path.withCString({ rf_initialize($0) }) else {
            throw RapfiError.message("Rapfi 初始化失败")
        }
        let response = String(cString: pointer)
        guard response == "ready" else { throw RapfiError.message(response) }
        initialized = true
    }

    private func command(stones: [Stone], side: StoneSide, rule: GameRule, depth: Int, multiPV: Int) -> String {
        let budget = [8: 1800, 10: 3000, 12: 5500, 14: 9000, 16: 15000][depth] ?? 3000
        var text = "START 15\nYXSHOWINFO\nINFO RULE \(rule.protocolCode)\n"
        text += "INFO TIMEOUT_TURN \(budget)\nINFO MAX_DEPTH \(depth)\n"
        text += "INFO SHOW_DETAIL 2\nINFO THREAD_NUM 1\nYXBOARD\n"
        for stone in stones { text += "\(stone.x),\(stone.y),\(stone.side.rawValue)\n" }
        text += "DONE\nYXNBEST \(multiPV)\n"
        return text
    }

    private static func parse(_ raw: String) -> [EngineLine] {
        struct Builder {
            var rank = 0, depth = 0
            var evaluation: Int?, mate: Int?
            var mateWin = false, mateLoss = false
            var winRate: Double?
            var variation: [BoardPoint] = []
        }
        var completed: [Int: EngineLine] = [:]
        var current: Builder?
        var finalMove: BoardPoint?
        for source in raw.split(whereSeparator: \.isNewline) {
            let line = String(source).trimmingCharacters(in: .whitespaces)
            if let value = capture(line, #"^INFO PV (\d+)$"#).first.flatMap(Int.init) {
                current = Builder(rank: value + 1)
            } else if var builder = current, let value = capture(line, #"^INFO DEPTH (\d+)$"#).first.flatMap(Int.init) {
                builder.depth = value; current = builder
            } else if var builder = current, let value = capture(line, #"^INFO EVAL ([+-]?\d+)$"#).first.flatMap(Int.init) {
                builder.evaluation = value; current = builder
            } else if var builder = current, let groups = optionalCapture(line, #"^INFO EVAL ([+-])M(\d+|\*)$"#) {
                if groups[1] == "*" { builder.mateWin = groups[0] == "+"; builder.mateLoss = !builder.mateWin }
                else if let value = Int(groups[1]) { builder.mate = (groups[0] == "+" ? 1 : -1) * value }
                current = builder
            } else if var builder = current, let value = capture(line, #"^INFO WINRATE ([\d.]+)$"#).first.flatMap(Double.init) {
                builder.winRate = value; current = builder
            } else if var builder = current, line.hasPrefix("INFO BESTLINE ") {
                let regex = try! NSRegularExpression(pattern: #"(\d+),(\d+)"#)
                let range = NSRange(line.startIndex..., in: line)
                builder.variation = regex.matches(in: line, range: range).compactMap { match in
                    guard let xr = Range(match.range(at: 1), in: line), let yr = Range(match.range(at: 2), in: line) else { return nil }
                    return BoardPoint(x: Int(line[xr])!, y: Int(line[yr])!)
                }
                current = builder
            } else if line == "INFO PV DONE", let builder = current, !builder.variation.isEmpty {
                completed[builder.rank] = EngineLine(rank: builder.rank, depth: builder.depth, evaluation: builder.evaluation, mate: builder.mate, mateWin: builder.mateWin, mateLoss: builder.mateLoss, winRate: builder.winRate, variation: builder.variation)
                current = nil
            } else if let groups = optionalCapture(line, #"^(\d+),(\d+)$"#), let x = Int(groups[0]), let y = Int(groups[1]) {
                finalMove = BoardPoint(x: x, y: y)
            }
        }
        if completed.isEmpty, let finalMove {
            completed[1] = EngineLine(rank: 1, depth: 0, evaluation: nil, mate: nil, mateWin: false, mateLoss: false, winRate: nil, variation: [finalMove])
        }
        return completed.values.sorted { $0.strength == $1.strength ? $0.rank < $1.rank : $0.strength > $1.strength }
    }

    private static func capture(_ text: String, _ pattern: String) -> [String] {
        optionalCapture(text, pattern) ?? []
    }

    private static func optionalCapture(_ text: String, _ pattern: String) -> [String]? {
        let regex = try! NSRegularExpression(pattern: pattern)
        guard let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) else { return nil }
        return (1..<match.numberOfRanges).compactMap { index in
            Range(match.range(at: index), in: text).map { String(text[$0]) }
        }
    }
}

enum RapfiError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let text) = self { text } else { "Rapfi 错误" } }
}
