#!/usr/bin/env swift
// Slices a 4x2 grid image of circular character portraits into individual 512x512 PNG files
// Usage: swift scripts/slice_portrait_sheet.swift <path-to-sheet.jpg> char1 char2 char3 char4 char5 char6 char7 char8

import AppKit
import Foundation

let args = CommandLine.arguments
guard args.count >= 10 else {
    print("Usage: swift scripts/slice_portrait_sheet.swift <sheet-image> <8 character IDs...>")
    print("Example Sheet 1: swift scripts/slice_portrait_sheet.swift sheet1.jpg tariel avtandil tinatin nestan asmat pridon rostevan rustaveli")
    print("Example Sheet 2: swift scripts/slice_portrait_sheet.swift sheet2.jpg asmat parsadan saridan davari ramaz fatman dulardukht usen")
    exit(1)
}

let imagePath = args[1]
let charIDs = Array(args[2..<10])
guard let srcImage = NSImage(contentsOfFile: imagePath),
      let tiffData = srcImage.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData) else {
    print("Failed to load image at \(imagePath)")
    exit(1)
}

let imgW = CGFloat(bitmap.pixelsWide)
let imgH = CGFloat(bitmap.pixelsHigh)
let cellW = imgW / 4.0
let cellH = imgH / 2.0
let cropSide = min(cellW, cellH) * 0.86

let outDir = URL(fileURLWithPath: "/Users/Nikoloz/Desktop/pantersskin/assets/characters")

for (idx, cid) in charIDs.enumerated() {
    let col = CGFloat(idx % 4)
    let row = CGFloat(idx / 4)
    // NSImage coordinates have origin at bottom-left
    let centerX = (col + 0.5) * cellW
    let centerY = imgH - (row + 0.5) * cellH
    let srcRect = NSRect(x: centerX - cropSide / 2.0, y: centerY - cropSide / 2.0, width: cropSide, height: cropSide)

    guard let outRep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: 512,
        pixelsHigh: 512,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else { continue }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: outRep)
    let path = NSBezierPath(ovalIn: NSRect(x: 0, y: 0, width: 512, height: 512))
    path.addClip()
    srcImage.draw(in: NSRect(x: 0, y: 0, width: 512, height: 512), from: srcRect, operation: .copy, fraction: 1.0)
    NSGraphicsContext.restoreGraphicsState()

    if let pngData = outRep.representation(using: .png, properties: [:]) {
        let outURL = outDir.appendingPathComponent("\(cid).png")
        try pngData.write(to: outURL)
        print("Saved \(outURL.path)")
    }
}
