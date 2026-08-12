import SwiftUI

struct SituationChartView: View {
    @Environment(\.colorScheme) private var colorScheme
    let points: [EvaluationPoint]
    let historyCount: Int
    @Binding var activePly: Int
    @Binding var isExpanded: Bool
    let onSelect: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading) {
                    Text("局势图").font(.headline)
                    Text("黑方视角 · 拖动可快速回看").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Text(label(for: activePly)).font(.subheadline.bold()).foregroundStyle(.green)
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { isExpanded.toggle() }
                } label: {
                    Image(systemName: isExpanded ? "chevron.up.circle.fill" : "chevron.down.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.green)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isExpanded ? "折叠局势图" : "展开局势图")
            }
            if isExpanded {
                GeometryReader { proxy in
                let size = proxy.size
                let largest = points.filter { $0.forcedWinner == nil }.map { abs($0.score) }.max() ?? 0
                let range = max(300, ceil(largest / 100) * 100)
                ZStack {
                    ForEach([-1.0, -0.5, 0.0, 0.5, 1.0], id: \.self) { fraction in
                        let y = size.height / 2 - CGFloat(fraction) * size.height * 0.42
                        Path { path in
                            path.move(to: CGPoint(x: 42, y: y))
                            path.addLine(to: CGPoint(x: size.width, y: y))
                        }.stroke(.secondary.opacity(fraction == 0 ? 0.35 : 0.16), lineWidth: 1)
                        Text(scoreLabel(range * fraction)).font(.system(size: 9, design: .monospaced))
                            .foregroundStyle(.secondary).frame(width: 36, alignment: .trailing).position(x: 18, y: y)
                    }
                    Path { path in
                        for (index, item) in points.sorted(by: { $0.ply < $1.ply }).enumerated() {
                            let point = location(item, size: size, range: range)
                            index == 0 ? path.move(to: point) : path.addLine(to: point)
                        }
                    }.stroke(Color(red: 0.66, green: 0.2, blue: 0.17), style: StrokeStyle(lineWidth: 2.5, lineJoin: .round))
                    ForEach(points) { item in
                        let point = location(item, size: size, range: range)
                        Circle().fill(item.ply == activePly ? Color.green : Color(red: 0.66, green: 0.2, blue: 0.17)).frame(width: item.ply == activePly ? 13 : 8, height: item.ply == activePly ? 13 : 8).position(point)
                    }
                }
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0).onChanged { gesture in
                    let ply = Int(round(max(0, min(1, gesture.location.x / max(1, size.width))) * CGFloat(max(1, historyCount))))
                    if ply != activePly { activePly = ply; onSelect(ply) }
                })
            }
                .frame(height: 150)
                Slider(value: Binding(get: { Double(activePly) }, set: { value in
                    activePly = Int(value.rounded()); onSelect(activePly)
                }), in: 0...Double(max(1, historyCount)), step: 1)
            }
        }
        .padding(16)
        .background(
            colorScheme == .dark
                ? Color(red: 0.13, green: 0.145, blue: 0.135)
                : Color.white.opacity(0.78),
            in: RoundedRectangle(cornerRadius: 16)
        )
    }

    private func location(_ item: EvaluationPoint, size: CGSize, range: Double) -> CGPoint {
        let x = 42 + CGFloat(item.ply) / CGFloat(max(1, historyCount)) * max(1, size.width - 42)
        let normalized: Double
        if item.forcedWinner == .black { normalized = 1 }
        else if item.forcedWinner == .white { normalized = -1 }
        else { normalized = max(-1, min(1, item.score / range)) }
        return CGPoint(x: x, y: size.height / 2 - CGFloat(normalized) * (size.height * 0.42))
    }

    private func scoreLabel(_ value: Double) -> String {
        if value == 0 { return "0" }
        return String(format: "%+.1f", value / 100)
    }

    private func label(for ply: Int) -> String {
        guard let item = points.first(where: { $0.ply == ply }) else { return "第 \(ply) 手 · 计算中" }
        if let winner = item.forcedWinner { return "\(winner.name)方胜势" }
        return "第 \(ply) 手 · \(String(format: "%+.2f", item.score / 100))"
    }
}
