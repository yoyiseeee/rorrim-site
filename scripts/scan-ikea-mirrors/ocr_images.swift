import Foundation
import Vision

func fail(_ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(1)
}

let args = CommandLine.arguments
guard args.count >= 3 else {
    fail("Usage: ocr_images.swift <page-dir> <output-json>")
}

let pageDir = URL(fileURLWithPath: args[1], isDirectory: true)
let outputURL = URL(fileURLWithPath: args[2])

let files: [URL]
do {
    files = try FileManager.default.contentsOfDirectory(
        at: pageDir,
        includingPropertiesForKeys: nil
    )
    .filter { $0.lastPathComponent.hasPrefix("page_") && $0.pathExtension.lowercased() == "png" }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
} catch {
    fail("Could not list \(pageDir.path): \(error.localizedDescription)")
}

func pageNumber(from url: URL) -> Int {
    let name = url.deletingPathExtension().lastPathComponent
    return Int(name.replacingOccurrences(of: "page_", with: "")) ?? 0
}

var records: [[String: Any]] = []

for file in files {
    autoreleasepool {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = ["en-US", "sv-SE"]

        let handler = VNImageRequestHandler(url: file, options: [:])
        do {
            try handler.perform([request])
        } catch {
            records.append([
                "page": pageNumber(from: file),
                "image": file.lastPathComponent,
                "text": "",
                "error": error.localizedDescription
            ])
            return
        }

        let text = (request.results ?? [])
            .compactMap { $0.topCandidates(1).first?.string }
            .joined(separator: "\n")

        records.append([
            "page": pageNumber(from: file),
            "image": file.lastPathComponent,
            "text": text
        ])
    }
}

do {
    let data = try JSONSerialization.data(withJSONObject: records, options: [.prettyPrinted, .sortedKeys])
    try data.write(to: outputURL, options: .atomic)
} catch {
    fail("Could not write OCR JSON: \(error.localizedDescription)")
}

print("OCR processed \(records.count) pages")
