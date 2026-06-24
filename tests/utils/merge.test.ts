import { deepMerge } from "../../src/utils/merge"

describe("deepMerge", () => {
  it("merges non-overlapping keys", () => {
    const result = deepMerge({ a: 1 }, { b: 2 } as never)
    expect(result).toEqual({ a: 1, b: 2 })
  })

  it("source values overwrite target values for primitives", () => {
    const result = deepMerge({ a: 1, b: "old" }, { b: "new" })
    expect(result).toEqual({ a: 1, b: "new" })
  })

  it("recursively merges nested objects", () => {
    const target = { nested: { x: 1, y: 2 } }
    const source = { nested: { y: 99 } }
    const result = deepMerge(target, source)
    expect(result).toEqual({ nested: { x: 1, y: 99 } })
  })

  it("overwrites array values (does not merge arrays)", () => {
    const result = deepMerge({ arr: [1, 2, 3] }, { arr: [4, 5] })
    expect(result).toEqual({ arr: [4, 5] })
  })

  it("skips undefined source values", () => {
    const result = deepMerge({ a: 1 }, { a: undefined })
    expect(result).toEqual({ a: 1 })
  })

  it("does not modify the original target", () => {
    const target = { a: 1 }
    deepMerge(target, { b: 2 } as never)
    expect(target).toEqual({ a: 1 })
  })

  it("handles empty source", () => {
    const result = deepMerge({ a: 1, b: 2 }, {})
    expect(result).toEqual({ a: 1, b: 2 })
  })

  it("handles deeply nested merge", () => {
    const target = { a: { b: { c: 1, d: 2 } } }
    const source = { a: { b: { d: 99 } } }
    const result = deepMerge(target, source)
    expect(result).toEqual({ a: { b: { c: 1, d: 99 } } })
  })

  it("null source value overwrites target", () => {
    const result = deepMerge({ a: 1 } as Record<string, unknown>, { a: null })
    expect(result["a"]).toBeNull()
  })
})
