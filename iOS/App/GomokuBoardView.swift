import SwiftUI

struct GomokuBoardView: View {
    let stones: [Stone]
    let turn: StoneSide
    let candidates: [EngineLine]
    let showBest: Bool
    let flipped: Bool
    let previewLine: EngineLine?
    let previewCount: Int
    let onTap: (BoardPoint) -> Void

    private let wood = Color(red: 0.82, green: 0.66, blue: 0.39)

    var body: some View {
        GeometryReader { proxy in
            let size = min(proxy.size.width, proxy.size.height)
            let margin = size * 0.075
            let step = (size - margin * 2) / 14
            Canvas { context, _ in
                context.fill(Path(CGRect(x: 0, y: 0, width: size, height: size)), with: .color(wood))
                var grid = Path()
                for index in 0..<15 {
                    let offset = margin + CGFloat(index) * step
                    grid.move(to: CGPoint(x: margin, y: offset)); grid.addLine(to: CGPoint(x: size - margin, y: offset))
                    grid.move(to: CGPoint(x: offset, y: margin)); grid.addLine(to: CGPoint(x: offset, y: size - margin))
                }
                context.stroke(grid, with: .color(.black.opacity(0.62)), lineWidth: 0.8)

                for x in [3, 7, 11] { for y in [3, 7, 11] {
                    let point = screenPoint(x: x, y: y, size: size, margin: margin, step: step)
                    context.fill(Path(ellipseIn: CGRect(x: point.x - 2.3, y: point.y - 2.3, width: 4.6, height: 4.6)), with: .color(.black.opacity(0.75)))
                }}

                for index in 0..<15 {
                    let letterIndex = flipped ? 14 - index : index
                    let letter = String(Character(UnicodeScalar(65 + letterIndex)!))
                    context.draw(Text(letter).font(.caption2.bold()).foregroundStyle(.brown.opacity(0.9)), at: CGPoint(x: margin + CGFloat(index) * step, y: size - margin * 0.38))
                    let row = flipped ? index + 1 : 15 - index
                    context.draw(Text("\(row)").font(.caption2.bold()).foregroundStyle(.brown.opacity(0.9)), at: CGPoint(x: margin * 0.34, y: margin + CGFloat(index) * step))
                }

                for stone in stones {
                    drawStone(stone, in: &context, size: size, margin: margin, step: step)
                }

                if showBest {
                    for (index, line) in candidates.prefix(4).enumerated() {
                        guard let target = line.variation.first else { continue }
                        let point = screenPoint(x: target.x, y: target.y, size: size, margin: margin, step: step)
                        let radius = step * 0.29
                        context.fill(Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)), with: .color(index == 0 ? .green.opacity(0.88) : .blue.opacity(0.78)))
                        context.draw(Text("\(index + 1)").font(.caption.bold()).foregroundStyle(.white), at: point)
                    }
                }

                if let previewLine {
                    for (index, target) in previewLine.variation.prefix(previewCount).enumerated() {
                        let side = index.isMultiple(of: 2) ? turn : turn.opposite
                        let point = screenPoint(x: target.x, y: target.y, size: size, margin: margin, step: step)
                        let radius = step * 0.34
                        context.fill(Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)), with: .color(side == .black ? Color.black : Color.white))
                        context.stroke(Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)), with: .color(.green), lineWidth: 2)
                        let label = "\(index / 2 + 1)"
                        context.draw(Text(label).font(.caption2.bold()).foregroundStyle(side == .black ? .white : .black), at: point)
                    }
                }
            }
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onEnded { value in
                let sx = Int(round((value.location.x - margin) / step))
                let sy = Int(round((value.location.y - margin) / step))
                guard (0..<15).contains(sx), (0..<15).contains(sy) else { return }
                onTap(BoardPoint(x: flipped ? 14 - sx : sx, y: flipped ? 14 - sy : sy))
            })
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: .black.opacity(0.18), radius: 10, y: 5)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityLabel("15乘15五子棋棋盘")
    }

    private func screenPoint(x: Int, y: Int, size: CGFloat, margin: CGFloat, step: CGFloat) -> CGPoint {
        let sx = flipped ? 14 - x : x
        let sy = flipped ? 14 - y : y
        return CGPoint(x: margin + CGFloat(sx) * step, y: margin + CGFloat(sy) * step)
    }

    private func drawStone(_ stone: Stone, in context: inout GraphicsContext, size: CGFloat, margin: CGFloat, step: CGFloat) {
        let point = screenPoint(x: stone.x, y: stone.y, size: size, margin: margin, step: step)
        let radius = step * 0.39
        let rect = CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)
        context.fill(Path(ellipseIn: rect), with: .color(stone.side == .black ? .black : Color(white: 0.97)))
        context.stroke(Path(ellipseIn: rect), with: .color(.black.opacity(0.45)), lineWidth: 1)
    }
}
