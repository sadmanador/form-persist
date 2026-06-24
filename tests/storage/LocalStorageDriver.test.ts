/**
 * @jest-environment jsdom
 */
import { LocalStorageDriver, isQuotaError } from "../../src/storage/LocalStorageDriver"

// ── isQuotaError ──────────────────────────────────────────────────────────────

describe("isQuotaError", () => {
  it("returns true for QuotaExceededError by name", () => {
    const e = Object.assign(new Error("quota"), { name: "QuotaExceededError" })
    expect(isQuotaError(e)).toBe(true)
  })

  it("returns true for NS_ERROR_DOM_QUOTA_REACHED", () => {
    const e = Object.assign(new Error("quota"), { name: "NS_ERROR_DOM_QUOTA_REACHED" })
    expect(isQuotaError(e)).toBe(true)
  })

  it("returns false for generic errors", () => {
    expect(isQuotaError(new Error("boom"))).toBe(false)
  })

  it("returns false for non-Error values", () => {
    expect(isQuotaError("quota")).toBe(false)
    expect(isQuotaError(null)).toBe(false)
    expect(isQuotaError(42)).toBe(false)
  })
})

// ── LocalStorageDriver ────────────────────────────────────────────────────────

describe("LocalStorageDriver", () => {
  let driver: LocalStorageDriver

  beforeEach(() => {
    localStorage.clear()
    // Reset availability cache between tests
    driver = new LocalStorageDriver()
  })

  afterEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
  })

  it("set and get a value", async () => {
    await driver.set("key1", "value1")
    expect(await driver.get("key1")).toBe("value1")
  })

  it("get returns null for missing key", async () => {
    expect(await driver.get("missing")).toBeNull()
  })

  it("overwrites existing value", async () => {
    await driver.set("k", "old")
    await driver.set("k", "new")
    expect(await driver.get("k")).toBe("new")
  })

  it("delete removes a key", async () => {
    await driver.set("k", "v")
    await driver.delete("k")
    expect(await driver.get("k")).toBeNull()
  })

  it("delete on missing key is a no-op", async () => {
    await expect(driver.delete("nonexistent")).resolves.toBeUndefined()
  })

  it("keys returns keys with matching prefix", async () => {
    await driver.set("form-persist:a", "1")
    await driver.set("form-persist:b", "2")
    await driver.set("other:c", "3")
    const result = await driver.keys("form-persist:")
    expect(result.sort()).toEqual(["form-persist:a", "form-persist:b"])
  })

  it("keys returns empty array when no match", async () => {
    await driver.set("other:x", "y")
    expect(await driver.keys("form-persist:")).toEqual([])
  })

  it("clear removes only keys with matching prefix", async () => {
    await driver.set("form-persist:a", "1")
    await driver.set("form-persist:b", "2")
    await driver.set("other:c", "3")
    await driver.clear("form-persist:")
    expect(await driver.get("form-persist:a")).toBeNull()
    expect(await driver.get("form-persist:b")).toBeNull()
    expect(await driver.get("other:c")).toBe("3")
  })

  it("logs warning when value exceeds soft limit", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
    const big = "x".repeat(4 * 1024 * 1024 + 1)
    await driver.set("form-persist:big", big)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("form-persist"))
  })

  it("propagates QuotaExceededError from localStorage.setItem", async () => {
    // Pre-warm the availability cache so _isAvailable() returns true before the mock
    await driver.set("warmup", "x")
    await driver.delete("warmup")

    const quota = new DOMException("quota", "QuotaExceededError")
    jest.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(() => {
      throw quota
    })
    await expect(driver.set("k", "v")).rejects.toThrow()
  })

  it("returns null when localStorage is unavailable", async () => {
    jest.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("unavailable")
    })
    // Force re-evaluation of availability by creating a new instance
    const d = new LocalStorageDriver()
    expect(await d.get("k")).toBeNull()
    expect(await d.keys("form-persist:")).toEqual([])
  })
})
