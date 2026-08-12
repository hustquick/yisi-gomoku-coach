import Foundation

enum StoneSide: Int, Codable, CaseIterable {
    case black = 1
    case white = 2

    var opposite: StoneSide { self == .black ? .white : .black }
    var name: String { self == .black ? "黑" : "白" }
}

struct Stone: Identifiable, Hashable, Codable {
    let x: Int
    let y: Int
    let side: StoneSide
    var id: String { "\(x)-\(y)" }
}

struct BoardPoint: Hashable, Codable {
    let x: Int
    let y: Int
    var name: String { "\(Character(UnicodeScalar(65 + x)!))\(15 - y)" }
}

struct EngineLine: Identifiable, Hashable {
    let rank: Int
    let depth: Int
    let evaluation: Int?
    let mate: Int?
    let mateWin: Bool
    let mateLoss: Bool
    let winRate: Double?
    let variation: [BoardPoint]

    var id: String { "\(rank)-\(variation.first?.name ?? "-")-\(depth)" }
    var strength: Double {
        if mateWin { return 1_000_000 }
        if let mate, mate > 0 { return 1_000_000 - Double(mate) }
        if mateLoss { return -1_000_000 }
        if let mate, mate < 0 { return -1_000_000 + Double(abs(mate)) }
        if let evaluation { return Double(evaluation) }
        return winRate.map { ($0 - 0.5) * 1000 } ?? -.infinity
    }
    var scoreText: String {
        if mateWin || (mate ?? 0) > 0 { return "本方胜势\(mate.map { " M\(abs($0))" } ?? "")" }
        if mateLoss || (mate ?? 0) < 0 { return "本方败势\(mate.map { " M\(abs($0))" } ?? "")" }
        guard let evaluation else { return "待计算" }
        return String(format: "%+.2f", Double(evaluation) / 100)
    }
}

struct EvaluationPoint: Identifiable, Hashable {
    let ply: Int
    let score: Double
    let forcedWinner: StoneSide?
    let mateIn: Int?
    var id: Int { ply }
}

enum PlayMode: String, CaseIterable {
    case local = "双人对弈"
    case computer = "人机对战"
    case setup = "摆盘"
}

enum GameRule: String, CaseIterable {
    case freestyle = "自由五子棋"
    case standard = "标准五子棋"
    case renju = "连珠"

    var protocolCode: Int {
        switch self {
        case .freestyle: 0
        case .standard: 1
        case .renju: 4
        }
    }
}

