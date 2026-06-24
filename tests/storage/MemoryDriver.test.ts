import { MemoryDriver } from "../../src/storage/MemoryDriver"

describe("MemoryDriver", () => {
  let driver: MemoryDriver

  beforeEach(() => {
    driver = new MemoryDriver()
  })

  // ── get / set ───────────────────────────────────────────────────────────────

  it("set and get a value", async () => {
    await driver.set("key1", "value1")
    expect(await driver.get("key1")).toBe("value1")
  })

  it("get returns null for missing key", async () => {
    expect(await driver.get("missing")).toBeNull()
  })

  it("overwrites existing value", async () => {
    await driver.set("k", "first")
    await driver.set("k", "second")
    expect(await driver.get("k")).toBe("second")
  })

  it("stores multiple independent keys", async () => {
    await driver.set("a", "1")
    await driver.set("b", "2")
    expect(await driver.get("a")).toBe("1")
    expect(await driver.get("b")).toBe("2")
  })

  // ── delete ──────────────────────────────────────────────────────────────────

  it("deletes a key", async () => {
    await driver.set("k", "v")
    await driver.delete("k")
    expect(await driver.get("k")).toBeNull()
  })

  it("delete on missing key is a no-op", async () => {
    await expect(driver.delete("nonexistent")).resolves.toBeUndefined()
  })

  // ── keys ────────────────────────────────────────────────────────────────────

  it("keys returns all keys matching prefix", async () => {
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

  it("keys returns empty array on empty store", async () => {
    expect(await driver.keys("form-persist:")).toEqual([])
  })

  // ── clear ───────────────────────────────────────────────────────────────────

  it("clear removes only keys with matching prefix", async () => {
    await driver.set("form-persist:a", "1")
    await driver.set("form-persist:b", "2")
    await driver.set("other:c", "3")
    await driver.clear("form-persist:")
    expect(await driver.get("form-persist:a")).toBeNull()
    expect(await driver.get("form-persist:b")).toBeNull()
    expect(await driver.get("other:c")).toBe("3")
  })

  it("clear on empty store is a no-op", async () => {
    await expect(driver.clear("form-persist:")).resolves.toBeUndefined()
  })

  // ── isolation ───────────────────────────────────────────────────────────────

  it("two MemoryDriver instances are isolated", async () => {
    const driver2 = new MemoryDriver()
    await driver.set("k", "from driver 1")
    expect(await driver2.get("k")).toBeNull()
  })
})
