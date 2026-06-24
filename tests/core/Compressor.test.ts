import { compress, decompress } from "../../src/core/Compressor"

// ── Round-trip tests ──────────────────────────────────────────────────────────

describe("compress / decompress round-trips", () => {
  const cases: [string, string][] = [
    ["single char", "a"],
    ["empty string via decompress empty", ""],
    ["short word", "hello"],
    ["repeated chars", "aaaaaaaaaa"],
    ["repeated pattern", "abcabcabcabc"],
    ["JSON object", '{"name":"Alice","age":30}'],
    ["long JSON array", JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ id: i, value: `item-${i}` })))],
    ["unicode chars", "こんにちは世界"],
    ["form JSON with typical fields", JSON.stringify({
      key: "vaccine-arrival-report",
      version: 1,
      currentStep: 2,
      totalSteps: 5,
      steps: {
        0: { data: { facilityCode: "DHK-001", arrivalDate: "2024-01-15" }, valid: true },
        1: { data: { batchNumber: "BATCH-2024-0042", quantity: 500 }, valid: true },
      },
      createdAt: 1705305600000,
      updatedAt: 1705309200000,
      expiresAt: 1705392000000,
      encrypted: false,
      compressed: true,
    })],
    ["string with special chars", 'She said "hello" & <goodbye>'],
    ["newlines and tabs", "line1\nline2\n\tindented"],
    ["numbers only", "1234567890123456789"],
    ["url string", "https://example.com/api/v1/forms?step=2&id=abc123"],
  ]

  for (const [label, input] of cases) {
    it(`round-trips: ${label}`, () => {
      if (input === "") {
        expect(decompress("")).toBe("")
        return
      }
      const compressed = compress(input)
      const decompressed = decompress(compressed)
      expect(decompressed).toBe(input)
    })
  }
})

// ── Compression efficiency ────────────────────────────────────────────────────

describe("compression efficiency", () => {
  it("compresses repetitive form JSON to less than original", () => {
    const input = JSON.stringify(
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        facilityCode: `FAC-${i.toString().padStart(3, "0")}`,
        batchNumber: `BATCH-2024-${i.toString().padStart(4, "0")}`,
        quantity: 100 + i,
      }))
    )
    const compressed = compress(input)
    expect(compressed.length).toBeLessThan(input.length)
  })
})

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("compress('') returns empty string", () => {
    expect(compress("")).toBe("")
  })

  it("decompress('') returns empty string", () => {
    expect(decompress("")).toBe("")
  })

  it("handles single character strings", () => {
    for (const c of ["a", "z", "0", "!", " ", "\n"]) {
      expect(decompress(compress(c))).toBe(c)
    }
  })

  it("handles high-code-point characters (>255)", () => {
    const input = "αβγδ — emoji: 🎉"
    expect(decompress(compress(input))).toBe(input)
  })

  it("compressing the same string twice gives the same result", () => {
    const input = "deterministic compression test"
    expect(compress(input)).toBe(compress(input))
  })

  it("all-whitespace string", () => {
    const input = "     \t\t\n  "
    expect(decompress(compress(input))).toBe(input)
  })
})
