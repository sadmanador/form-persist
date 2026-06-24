/**
 * @jest-environment jsdom
 */
import { SessionStorageDriver } from "../../src/storage/SessionStorageDriver"

describe("SessionStorageDriver", () => {
  let driver: SessionStorageDriver

  beforeEach(() => {
    sessionStorage.clear()
    driver = new SessionStorageDriver()
  })

  afterEach(() => {
    sessionStorage.clear()
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

  it("returns null when sessionStorage is unavailable", async () => {
    jest.spyOn(window.sessionStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("unavailable")
    })
    const d = new SessionStorageDriver()
    expect(await d.get("k")).toBeNull()
  })

  it("keys returns empty array when sessionStorage is unavailable", async () => {
    jest.spyOn(window.sessionStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("unavailable")
    })
    const d = new SessionStorageDriver()
    expect(await d.keys("form-persist:")).toEqual([])
  })

  it("set is a no-op when sessionStorage is unavailable", async () => {
    jest.spyOn(window.sessionStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("unavailable")
    })
    const d = new SessionStorageDriver()
    await expect(d.set("k", "v")).resolves.toBeUndefined()
  })

  it("delete is a no-op when sessionStorage is unavailable", async () => {
    jest.spyOn(window.sessionStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("unavailable")
    })
    const d = new SessionStorageDriver()
    await expect(d.delete("k")).resolves.toBeUndefined()
  })
})
