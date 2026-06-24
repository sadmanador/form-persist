import { clearAllForms, clearForms, runCleanup } from "../src/globals"
import { MemoryDriver } from "../src/storage/MemoryDriver"

const PREFIX = "form-persist:"

async function seed(driver: MemoryDriver, keys: string[], value = "{}") {
  for (const k of keys) await driver.set(PREFIX + k, value)
}

describe("clearAllForms", () => {
  it("deletes all form-persist:* keys from the driver", async () => {
    const driver = new MemoryDriver()
    await seed(driver, ["form-a", "form-b"])
    await driver.set("other:x", "keep")

    await clearAllForms(driver)

    expect(await driver.get(PREFIX + "form-a")).toBeNull()
    expect(await driver.get(PREFIX + "form-b")).toBeNull()
    expect(await driver.get("other:x")).toBe("keep")
  })

  it("is a no-op on empty storage", async () => {
    const driver = new MemoryDriver()
    await expect(clearAllForms(driver)).resolves.toBeUndefined()
  })
})

describe("clearForms", () => {
  it("deletes only the listed form keys", async () => {
    const driver = new MemoryDriver()
    await seed(driver, ["form-a", "form-b", "form-c"])

    await clearForms(["form-a", "form-b"], driver)

    expect(await driver.get(PREFIX + "form-a")).toBeNull()
    expect(await driver.get(PREFIX + "form-b")).toBeNull()
    expect(await driver.get(PREFIX + "form-c")).not.toBeNull()
  })

  it("is a no-op for an empty key list", async () => {
    const driver = new MemoryDriver()
    await seed(driver, ["form-a"])
    await clearForms([], driver)
    expect(await driver.get(PREFIX + "form-a")).not.toBeNull()
  })
})

describe("globals without explicit storage (uses default MemoryDriver in SSR/Node)", () => {
  it("clearAllForms with no storage arg is a no-op", async () => {
    await expect(clearAllForms()).resolves.toBeUndefined()
  })

  it("clearForms with no storage arg is a no-op", async () => {
    await expect(clearForms([])).resolves.toBeUndefined()
  })

  it("runCleanup with no storage arg is a no-op", async () => {
    await expect(runCleanup()).resolves.toBeUndefined()
  })
})

describe("runCleanup", () => {
  it("deletes entries whose expiresAt is in the past", async () => {
    const driver = new MemoryDriver()
    const expired = JSON.stringify({ expiresAt: Date.now() - 1000 })
    const fresh = JSON.stringify({ expiresAt: Date.now() + 9999999 })

    await driver.set(PREFIX + "expired-form", expired)
    await driver.set(PREFIX + "fresh-form", fresh)

    await runCleanup(driver)

    expect(await driver.get(PREFIX + "expired-form")).toBeNull()
    expect(await driver.get(PREFIX + "fresh-form")).not.toBeNull()
  })

  it("removes corrupted entries", async () => {
    const driver = new MemoryDriver()
    await driver.set(PREFIX + "bad-form", "not-json!!!")

    await runCleanup(driver)

    expect(await driver.get(PREFIX + "bad-form")).toBeNull()
  })

  it("is a no-op on empty storage", async () => {
    const driver = new MemoryDriver()
    await expect(runCleanup(driver)).resolves.toBeUndefined()
  })
})

// ── LocalStorageDriver in Node/SSR environment (covers lines 24-25) ───────────
// These lines execute when typeof window === "undefined" (Node/SSR).
// LocalStorageDriver.test.ts runs in jsdom (window defined), so they can't be
// covered there. This Node-environment file covers that branch.

describe("LocalStorageDriver — Node/SSR environment (typeof window === undefined)", () => {
  it("get returns null when window is undefined", async () => {
    const { LocalStorageDriver } = await import("../src/storage/LocalStorageDriver")
    const driver = new LocalStorageDriver()
    expect(await driver.get("any-key")).toBeNull()
  })

  it("set is a no-op when window is undefined", async () => {
    const { LocalStorageDriver } = await import("../src/storage/LocalStorageDriver")
    const driver = new LocalStorageDriver()
    await expect(driver.set("k", "v")).resolves.toBeUndefined()
  })

  it("keys returns empty array when window is undefined", async () => {
    const { LocalStorageDriver } = await import("../src/storage/LocalStorageDriver")
    const driver = new LocalStorageDriver()
    expect(await driver.keys("form-persist:")).toEqual([])
  })
})
