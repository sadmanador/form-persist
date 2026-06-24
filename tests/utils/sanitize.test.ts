import { sanitizeData } from "../../src/utils/sanitize"

describe("sanitizeData", () => {
  it("returns data unchanged when exclude is empty", () => {
    const data = { a: 1, b: 2 }
    expect(sanitizeData(data, [])).toBe(data)
  })

  it("removes excluded fields", () => {
    const data = { username: "alice", password: "secret", cvv: "123" }
    const result = sanitizeData(data, ["password", "cvv"])
    expect(result).toEqual({ username: "alice" })
    expect(result).not.toHaveProperty("password")
    expect(result).not.toHaveProperty("cvv")
  })

  it("does not modify the original object", () => {
    const data = { a: 1, b: 2 }
    sanitizeData(data, ["b"])
    expect(data).toEqual({ a: 1, b: 2 })
  })

  it("ignores exclude entries that are not in data", () => {
    const data = { a: 1 }
    const result = sanitizeData(data, ["nonexistent"])
    expect(result).toEqual({ a: 1 })
  })

  it("returns empty object when all fields are excluded", () => {
    const data = { a: 1, b: 2 }
    const result = sanitizeData(data, ["a", "b"])
    expect(result).toEqual({})
  })
})
