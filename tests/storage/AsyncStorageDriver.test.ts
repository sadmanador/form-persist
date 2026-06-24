import { AsyncStorageDriver } from "../../src/storage/AsyncStorageDriver"
import type { AsyncStorageCompat } from "../../src/storage/AsyncStorageDriver"

function makeMockStorage(initial: Record<string, string> = {}): AsyncStorageCompat {
  const store: Record<string, string> = { ...initial }
  return {
    async getItem(key: string) {
      return store[key] ?? null
    },
    async setItem(key: string, value: string) {
      store[key] = value
    },
    async removeItem(key: string) {
      delete store[key]
    },
    async getAllKeys() {
      return Object.keys(store)
    },
    async multiRemove(keys: string[]) {
      for (const k of keys) delete store[k]
    },
  }
}

describe("AsyncStorageDriver", () => {
  it("get returns value that was set", async () => {
    const driver = new AsyncStorageDriver(makeMockStorage())
    await driver.set("k", "v")
    expect(await driver.get("k")).toBe("v")
  })

  it("get returns null for missing key", async () => {
    const driver = new AsyncStorageDriver(makeMockStorage())
    expect(await driver.get("missing")).toBeNull()
  })

  it("delete removes a key", async () => {
    const driver = new AsyncStorageDriver(makeMockStorage({ k: "v" }))
    await driver.delete("k")
    expect(await driver.get("k")).toBeNull()
  })

  it("keys returns keys matching prefix", async () => {
    const driver = new AsyncStorageDriver(
      makeMockStorage({
        "form-persist:a": "1",
        "form-persist:b": "2",
        "other:c": "3",
      })
    )
    const keys = await driver.keys("form-persist:")
    expect(keys.sort()).toEqual(["form-persist:a", "form-persist:b"])
  })

  it("keys returns empty array when no match", async () => {
    const driver = new AsyncStorageDriver(makeMockStorage({ "other:x": "y" }))
    expect(await driver.keys("form-persist:")).toEqual([])
  })

  it("clear removes only keys with matching prefix", async () => {
    const driver = new AsyncStorageDriver(
      makeMockStorage({
        "form-persist:a": "1",
        "form-persist:b": "2",
        "other:c": "3",
      })
    )
    await driver.clear("form-persist:")
    expect(await driver.get("form-persist:a")).toBeNull()
    expect(await driver.get("form-persist:b")).toBeNull()
    expect(await driver.get("other:c")).toBe("3")
  })

  it("clear is a no-op when no keys match", async () => {
    const driver = new AsyncStorageDriver(makeMockStorage({ "other:x": "y" }))
    await expect(driver.clear("form-persist:")).resolves.toBeUndefined()
  })
})
