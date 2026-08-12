import AppKit

let arguments = CommandLine.arguments
guard arguments.count == 3 else {
    fatalError("Usage: swift make_app_icon.swift LIGHT_OUTPUT.png DARK_OUTPUT.png")
}

let size = NSSize(width: 1024, height: 1024)
let canvas = NSRect(origin: .zero, size: size)
let brandRed = NSColor(calibratedRed: 0.67, green: 0.10, blue: 0.08, alpha: 1)
let darkFrame = NSColor(calibratedWhite: 0.055, alpha: 1)
let sharedInnerBase = NSColor(calibratedRed: 0.96, green: 0.89, blue: 0.76, alpha: 1)

func render(output: String, frameColor: NSColor) throws {
    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: 1024, pixelsHigh: 1024,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    ) else { fatalError("Could not create app icon bitmap") }
    bitmap.size = size
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)

    frameColor.setFill()
    canvas.fill()
    sharedInnerBase.setFill()
    NSBezierPath(roundedRect: canvas.insetBy(dx: 106, dy: 106), xRadius: 154, yRadius: 154).fill()

let gridColor = NSColor(calibratedRed: 0.39, green: 0.29, blue: 0.17, alpha: 1)
gridColor.setStroke()
for coordinate in stride(from: 256, through: 736, by: 160) {
    let vertical = NSBezierPath()
    vertical.move(to: NSPoint(x: coordinate, y: 192))
    vertical.line(to: NSPoint(x: coordinate, y: 832))
    vertical.lineWidth = 24
    vertical.stroke()

    let horizontal = NSBezierPath()
    horizontal.move(to: NSPoint(x: 192, y: coordinate))
    horizontal.line(to: NSPoint(x: 832, y: coordinate))
    horizontal.lineWidth = 24
    horizontal.stroke()
}

func stone(center: NSPoint, radius: CGFloat, fill: NSColor, stroke: NSColor) {
    let path = NSBezierPath(ovalIn: NSRect(
        x: center.x - radius, y: center.y - radius,
        width: radius * 2, height: radius * 2
    ))
    fill.setFill()
    path.fill()
    stroke.setStroke()
    path.lineWidth = 22
    path.stroke()
}

    stone(
        center: NSPoint(x: 416, y: 608), radius: 112,
        fill: NSColor(calibratedWhite: 0.08, alpha: 1),
        stroke: sharedInnerBase
    )
    stone(
        center: NSPoint(x: 576, y: 448), radius: 112,
        fill: NSColor(calibratedWhite: 0.96, alpha: 1),
        stroke: NSColor(calibratedWhite: 0.31, alpha: 1)
    )
    NSGraphicsContext.restoreGraphicsState()
    guard let png = bitmap.representation(using: .png, properties: [:]) else {
        fatalError("Could not render app icon")
    }
    try png.write(to: URL(fileURLWithPath: output))
}

try render(output: arguments[1], frameColor: brandRed)
try render(output: arguments[2], frameColor: darkFrame)
