import AppKit
import Foundation
import PDFKit

func fail(_ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(1)
}

let args = CommandLine.arguments
guard args.count >= 3 else {
    fail("Usage: render_pdf_pages.swift <catalogue.pdf> <output-dir> [max-width]")
}

let pdfPath = args[1]
let outputDir = args[2]
let maxWidth = CGFloat(Double(args.count >= 4 ? args[3] : "1800") ?? 1800)

let pdfURL = URL(fileURLWithPath: pdfPath)
guard let document = PDFDocument(url: pdfURL) else {
    fail("Could not open PDF: \(pdfPath)")
}

try FileManager.default.createDirectory(atPath: outputDir, withIntermediateDirectories: true)

let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
let pageCount = document.pageCount

for index in 0..<pageCount {
    autoreleasepool {
        guard let page = document.page(at: index) else {
            fail("Could not read page \(index + 1)")
        }

        let bounds = page.bounds(for: .mediaBox)
        let scale = maxWidth / max(bounds.width, 1)
        let pixelWidth = max(1, Int((bounds.width * scale).rounded(.up)))
        let pixelHeight = max(1, Int((bounds.height * scale).rounded(.up)))

        guard let context = CGContext(
            data: nil,
            width: pixelWidth,
            height: pixelHeight,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            fail("Could not create bitmap context for page \(index + 1)")
        }

        context.setFillColor(NSColor.white.cgColor)
        context.fill(CGRect(x: 0, y: 0, width: pixelWidth, height: pixelHeight))
        context.saveGState()
        context.scaleBy(x: scale, y: scale)
        page.draw(with: .mediaBox, to: context)
        context.restoreGState()

        guard let image = context.makeImage() else {
            fail("Could not render page \(index + 1)")
        }

        let bitmap = NSBitmapImageRep(cgImage: image)
        guard let data = bitmap.representation(using: .png, properties: [:]) else {
            fail("Could not encode PNG for page \(index + 1)")
        }

        let filename = String(format: "page_%04d.png", index + 1)
        let outputURL = URL(fileURLWithPath: outputDir).appendingPathComponent(filename)
        do {
            try data.write(to: outputURL, options: .atomic)
        } catch {
            fail("Could not write \(outputURL.path): \(error.localizedDescription)")
        }
    }
}

print("Rendered \(pageCount) pages to \(outputDir)")
