import { FormPersist } from "../../src/core/FormPersist"
import { MemoryDriver } from "../../src/storage/MemoryDriver"
import type { FormPersistConfig, ClearReason } from "../../src/types"

function makeDriver() {
  return new MemoryDriver()
}

function makeConfig(overrides: Partial<FormPersistConfig> = {}): FormPersistConfig {
  return {
    key: "test-form",
    ttl: "24h",
    storage: makeDriver(),
    ...overrides,
  }
}

// Use fake timers for debounce control
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// ── save + restore ────────────────────────────────────────────────────────────

describe("save and restore", () => {
  it("saves and restores step data", async () => {
    const driver = makeDriver()
    const fp = new FormPersist(makeConfig({ storage: driver }))

    const saveP = fp.save(0, { name: "Alice", city: "Dhaka" })
    jest.runAllTimers()
    await saveP

    const form = await fp.restore()
    expect(form).not.toBeNull()
    expect(form!.steps[0].data).toEqual({ name: "Alice", city: "Dhaka" })
    fp.destroy()
  })

  it("restores null when nothing is stored", async () => {
    const fp = new FormPersist(makeConfig())
    expect(await fp.restore()).toBeNull()
    fp.destroy()
  })

  it("saveAll saves at step 0", async () => {
    const fp = new FormPersist(makeConfig())
    await fp.saveAll({ field: "value" })
    const form = await fp.restore()
    expect(form!.steps[0].data).toEqual({ field: "value" })
    fp.destroy()
  })

  it("restores the currentStep correctly after save", async () => {
    const fp = new FormPersist(makeConfig({ steps: 4 }))
    const p = fp.save(2, { x: 1 })
    jest.runAllTimers()
    await p
    const form = await fp.restore()
    expect(form!.currentStep).toBe(2)
    fp.destroy()
  })

  it("onSave callback fires after save", async () => {
    const onSave = jest.fn()
    const fp = new FormPersist(makeConfig({ onSave }))
    const p = fp.save(0, { a: 1 })
    jest.runAllTimers()
    await p
    expect(onSave).toHaveBeenCalledTimes(1)
    fp.destroy()
  })

  it("onRestore callback fires on restore", async () => {
    const onRestore = jest.fn()
    const fp = new FormPersist(makeConfig({ onRestore }))
    await fp.saveAll({ x: 1 })
    await fp.restore()
    expect(onRestore).toHaveBeenCalledTimes(1)
    fp.destroy()
  })
})

// ── debounce ──────────────────────────────────────────────────────────────────

describe("save debounce", () => {
  it("only one write occurs for rapid consecutive calls", async () => {
    const driver = makeDriver()
    const setSpy = jest.spyOn(driver, "set")
    const fp = new FormPersist(makeConfig({ storage: driver, debounce: 300 }))

    // Fire 3 saves in quick succession without advancing timer
    const p1 = fp.save(0, { n: 1 })
    const p2 = fp.save(0, { n: 2 })
    const p3 = fp.save(0, { n: 3 })

    // Advance timer to trigger the debounce
    jest.runAllTimers()
    await Promise.all([p1, p2, p3])

    // Only one actual write, with the last payload
    expect(setSpy).toHaveBeenCalledTimes(1)
    const form = await fp.restore()
    expect(form!.steps[0].data).toEqual({ n: 3 })
    fp.destroy()
  })

  it("superseded promises resolve without writing", async () => {
    const fp = new FormPersist(makeConfig({ debounce: 300 }))
    const p1 = fp.save(0, { n: 1 })
    const p2 = fp.save(0, { n: 2 })
    jest.runAllTimers()
    // Both promises resolve without rejection
    await expect(p1).resolves.toBeUndefined()
    await expect(p2).resolves.toBeUndefined()
    fp.destroy()
  })
})

// ── expiry ────────────────────────────────────────────────────────────────────

describe("TTL / expiry", () => {
  it("restore returns null when data is expired", async () => {
    const onExpire = jest.fn()
    const fp = new FormPersist(makeConfig({ ttl: 1, onExpire }))
    await fp.saveAll({ x: 1 })

    // Fast-forward past the TTL
    jest.useRealTimers()
    await new Promise((r) => setTimeout(r, 10))

    expect(await fp.restore()).toBeNull()
    expect(onExpire).toHaveBeenCalled()
    fp.destroy()
  })

  it("hasData returns false for expired data", async () => {
    jest.useRealTimers()
    const fp = new FormPersist(makeConfig({ ttl: 1 }))
    await fp.saveAll({ x: 1 })
    await new Promise((r) => setTimeout(r, 10))
    expect(await fp.hasData()).toBe(false)
    fp.destroy()
  })

  it("extendTTL increases the expiry time", async () => {
    const fp = new FormPersist(makeConfig({ ttl: "24h" }))
    await fp.saveAll({ x: 1 })

    const before = await fp.timeRemaining()
    await fp.extendTTL(3_600_000) // +1 hour
    const after = await fp.timeRemaining()

    expect(after!).toBeGreaterThan(before!)
    fp.destroy()
  })
})

// ── version mismatch ──────────────────────────────────────────────────────────

describe("version mismatch", () => {
  it("discards saved data when version doesn't match", async () => {
    const driver = makeDriver()
    const onClear = jest.fn<void, [ClearReason]>()

    // Save with version 1
    const v1 = new FormPersist(makeConfig({ storage: driver, version: 1, onClear }))
    await v1.saveAll({ x: 1 })
    v1.destroy()

    // Restore with version 2 — should discard
    const v2 = new FormPersist(makeConfig({ storage: driver, version: 2, onClear }))
    const form = await v2.restore()
    expect(form).toBeNull()
    expect(onClear).toHaveBeenCalledWith("version-mismatch")
    v2.destroy()
  })
})

// ── exclude fields ────────────────────────────────────────────────────────────

describe("exclude fields", () => {
  it("excluded fields are not written to storage", async () => {
    const fp = new FormPersist(makeConfig({ exclude: ["password", "cvv"] }))
    await fp.saveAll({ username: "alice", password: "secret", cvv: "123" })

    const form = await fp.restore()
    expect(form!.steps[0].data).not.toHaveProperty("password")
    expect(form!.steps[0].data).not.toHaveProperty("cvv")
    expect(form!.steps[0].data).toHaveProperty("username", "alice")
    fp.destroy()
  })
})

// ── compression ───────────────────────────────────────────────────────────────

describe("compression", () => {
  it("round-trips correctly with compress: true (default)", async () => {
    const fp = new FormPersist(makeConfig({ compress: true }))
    await fp.saveAll({ data: "x".repeat(1000) })
    const form = await fp.restore()
    expect(form!.steps[0].data).toEqual({ data: "x".repeat(1000) })
    fp.destroy()
  })

  it("round-trips correctly with compress: false", async () => {
    const fp = new FormPersist(makeConfig({ compress: false }))
    await fp.saveAll({ field: "hello" })
    const form = await fp.restore()
    expect(form!.steps[0].data).toEqual({ field: "hello" })
    fp.destroy()
  })
})

// ── hasData ───────────────────────────────────────────────────────────────────

describe("hasData", () => {
  it("returns false when nothing is stored", async () => {
    const fp = new FormPersist(makeConfig())
    expect(await fp.hasData()).toBe(false)
    fp.destroy()
  })

  it("returns true after saving", async () => {
    const fp = new FormPersist(makeConfig())
    await fp.saveAll({ x: 1 })
    expect(await fp.hasData()).toBe(true)
    fp.destroy()
  })

  it("returns false after clearing", async () => {
    const fp = new FormPersist(makeConfig())
    await fp.saveAll({ x: 1 })
    await fp.clear("manual")
    expect(await fp.hasData()).toBe(false)
    fp.destroy()
  })
})

// ── clear ─────────────────────────────────────────────────────────────────────

describe("clear", () => {
  it("removes stored data", async () => {
    const fp = new FormPersist(makeConfig())
    await fp.saveAll({ x: 1 })
    await fp.clear("manual")
    expect(await fp.restore()).toBeNull()
    fp.destroy()
  })

  it("fires onClear with the given reason", async () => {
    const onClear = jest.fn()
    const fp = new FormPersist(makeConfig({ onClear }))
    await fp.saveAll({ x: 1 })
    await fp.clear("submit")
    expect(onClear).toHaveBeenCalledWith("submit")
    fp.destroy()
  })

  it("fires onExpire when clearing with 'expired' reason", async () => {
    const onExpire = jest.fn()
    const fp = new FormPersist(makeConfig({ onExpire }))
    await fp.saveAll({ x: 1 })
    await fp.clear("expired")
    expect(onExpire).toHaveBeenCalled()
    fp.destroy()
  })
})

// ── reset ─────────────────────────────────────────────────────────────────────

describe("reset", () => {
  it("clears step data and resets currentStep", async () => {
    const fp = new FormPersist(makeConfig({ steps: 3 }))
    const p = fp.save(2, { x: 1 })
    jest.runAllTimers()
    await p
    await fp.reset()
    const form = await fp.restore()
    expect(form!.currentStep).toBe(0)
    expect(form!.steps).toEqual({})
    fp.destroy()
  })

  it("fires onClear with reason 'reset'", async () => {
    const onClear = jest.fn()
    const fp = new FormPersist(makeConfig({ onClear }))
    await fp.saveAll({ x: 1 })
    await fp.reset()
    expect(onClear).toHaveBeenCalledWith("reset")
    fp.destroy()
  })
})

// ── clearStep ────────────────────────────────────────────────────────────────

describe("clearStep", () => {
  it("removes only the specified step", async () => {
    const fp = new FormPersist(makeConfig({ steps: 3 }))
    await fp.saveAll({ a: 1 })
    const p = fp.save(1, { b: 2 })
    jest.runAllTimers()
    await p
    await fp.clearStep(1)
    const form = await fp.restore()
    expect(form!.steps[0]).toBeDefined()
    expect(form!.steps[1]).toBeUndefined()
    fp.destroy()
  })
})

// ── completeStep ──────────────────────────────────────────────────────────────

describe("completeStep", () => {
  it("advances currentStep", async () => {
    const fp = new FormPersist(makeConfig({ steps: 4 }))
    await fp.completeStep(0, { a: 1 })
    const step = await fp.getCurrentStep()
    expect(step).toBe(1)
    fp.destroy()
  })

  it("sets completedAt on the step", async () => {
    const before = Date.now()
    const fp = new FormPersist(makeConfig({ steps: 3 }))
    await fp.completeStep(0, { a: 1 })
    const form = await fp.restore()
    expect(form!.steps[0].completedAt).toBeGreaterThanOrEqual(before)
    fp.destroy()
  })
})

// ── restoreStep ───────────────────────────────────────────────────────────────

describe("restoreStep", () => {
  it("returns the data for a specific step", async () => {
    const fp = new FormPersist(makeConfig({ steps: 3 }))
    await fp.completeStep(0, { stepZero: true })
    const data = await fp.restoreStep(0)
    expect(data).toEqual({ stepZero: true })
    fp.destroy()
  })

  it("returns null for a step that was never saved", async () => {
    const fp = new FormPersist(makeConfig({ steps: 3 }))
    await fp.saveAll({ x: 1 })
    expect(await fp.restoreStep(2)).toBeNull()
    fp.destroy()
  })
})

// ── getInfo ───────────────────────────────────────────────────────────────────

describe("getInfo", () => {
  it("returns exists: false when no data", async () => {
    const fp = new FormPersist(makeConfig())
    const info = await fp.getInfo()
    expect(info!.exists).toBe(false)
    fp.destroy()
  })

  it("returns correct metadata when data exists", async () => {
    const fp = new FormPersist(makeConfig({ steps: 3 }))
    await fp.completeStep(0, { x: 1 })
    const info = await fp.getInfo()
    expect(info!.exists).toBe(true)
    expect(info!.totalSteps).toBe(3)
    expect(info!.completedSteps).toContain(0)
    expect(info!.createdAt).toBeInstanceOf(Date)
    expect(info!.expiresAt).toBeInstanceOf(Date)
    expect(info!.sizeBytes).toBeGreaterThan(0)
    fp.destroy()
  })
})

// ── timeRemaining ─────────────────────────────────────────────────────────────

describe("timeRemaining", () => {
  it("returns null when no data", async () => {
    const fp = new FormPersist(makeConfig())
    expect(await fp.timeRemaining()).toBeNull()
    fp.destroy()
  })

  it("returns a positive number after saving", async () => {
    const fp = new FormPersist(makeConfig({ ttl: "24h" }))
    await fp.saveAll({ x: 1 })
    const remaining = await fp.timeRemaining()
    expect(remaining).toBeGreaterThan(0)
    fp.destroy()
  })
})

// ── fallback storage ──────────────────────────────────────────────────────────

describe("fallback storage", () => {
  it("reads from fallback driver when primary has no data", async () => {
    const primary = makeDriver()
    const fallback = makeDriver()

    // Seed data into fallback directly
    const seedForm = new FormPersist(makeConfig({ storage: fallback }))
    await seedForm.saveAll({ field: "from-fallback" })
    seedForm.destroy()

    // Read using primary (empty) + fallback
    const fp = new FormPersist(makeConfig({ storage: primary, fallbackStorage: fallback }))
    const form = await fp.restore()
    expect(form!.steps[0].data).toEqual({ field: "from-fallback" })
    fp.destroy()
  })
})

// ── corrupted data ────────────────────────────────────────────────────────────

describe("corrupted storage data", () => {
  it("restore returns null when storage contains invalid JSON", async () => {
    const driver = makeDriver()
    await driver.set("form-persist:test-form", "not-valid-json")
    const fp = new FormPersist(makeConfig({ storage: driver }))
    expect(await fp.restore()).toBeNull()
    fp.destroy()
  })

  it("onError fires when storage throws", async () => {
    const onError = jest.fn()
    const driver = makeDriver()
    jest.spyOn(driver, "get").mockRejectedValue(new Error("storage failure"))
    const fp = new FormPersist(makeConfig({ storage: driver, onError }))
    await fp.restore()
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    fp.destroy()
  })
})

// ── SSR safety ────────────────────────────────────────────────────────────────

describe("SSR / server environment", () => {
  it("uses MemoryDriver when storage is not specified and window is undefined", async () => {
    // In Node test environment, typeof window === 'undefined', so localStorage
    // is not used — the driver falls back to MemoryDriver automatically.
    const fp = new FormPersist({ key: "ssr-test", ttl: "24h" })
    await fp.saveAll({ ssr: true })
    const form = await fp.restore()
    expect(form!.steps[0].data).toEqual({ ssr: true })
    fp.destroy()
  })
})

// ── destroy ───────────────────────────────────────────────────────────────────

describe("destroy", () => {
  it("cancels pending debounced save without throwing", () => {
    const fp = new FormPersist(makeConfig())
    fp.save(0, { x: 1 }) // pending in debounce buffer — don't await
    expect(() => fp.destroy()).not.toThrow()
    jest.runAllTimers() // should not write after destroy
  })
})

// ── encryption (Node 18+ has globalThis.crypto.subtle) ───────────────────────

describe("encryption", () => {
  const PASS = "test-passphrase-32chars-long!!"

  it("round-trips encrypted data through saveAll + restore", async () => {
    jest.useRealTimers()
    const fp = new FormPersist(makeConfig({ encrypt: true, encryptionKey: PASS }))
    await fp.saveAll({ name: "Alice", age: 30 })
    const form = await fp.restore()
    expect(form!.steps[0].data["name"]).toBe("Alice")
    expect(form!.steps[0].data["age"]).toBe(30)
    fp.destroy()
  })

  it("stores ciphertext in storage — not plaintext", async () => {
    jest.useRealTimers()
    const driver = makeDriver()
    const fp = new FormPersist(makeConfig({ storage: driver, encrypt: true, encryptionKey: PASS, compress: false }))
    await fp.saveAll({ secret: "password123" })
    const raw = await driver.get("form-persist:test-form")
    expect(raw).not.toBeNull()
    expect(raw).not.toContain("password123")
    fp.destroy()
  })

  it("round-trips encrypted data through completeStep + restore", async () => {
    jest.useRealTimers()
    const fp = new FormPersist(makeConfig({ encrypt: true, encryptionKey: PASS, steps: 3 }))
    await fp.completeStep(0, { step0: "data" })
    const form = await fp.restore()
    expect(form!.steps[0].data["step0"]).toBe("data")
    fp.destroy()
  })
})

// ── additional edge cases ─────────────────────────────────────────────────────

describe("reset on empty storage", () => {
  it("is a no-op when no data exists", async () => {
    const fp = new FormPersist(makeConfig())
    await expect(fp.reset()).resolves.toBeUndefined()
    expect(await fp.hasData()).toBe(false)
    fp.destroy()
  })

  it("fires onClear('reset') even with no data", async () => {
    const onClear = jest.fn()
    const fp = new FormPersist(makeConfig({ onClear }))
    await fp.reset()
    expect(onClear).toHaveBeenCalledWith("reset")
    fp.destroy()
  })
})

describe("clearStep on empty storage", () => {
  it("is a no-op when no data exists", async () => {
    const fp = new FormPersist(makeConfig())
    await expect(fp.clearStep(0)).resolves.toBeUndefined()
    fp.destroy()
  })
})

describe("hasData with version mismatch", () => {
  it("returns false when saved version does not match config version", async () => {
    const driver = makeDriver()
    const v1 = new FormPersist(makeConfig({ storage: driver, version: 1 }))
    await v1.saveAll({ x: 1 })
    v1.destroy()

    const v2 = new FormPersist(makeConfig({ storage: driver, version: 2 }))
    expect(await v2.hasData()).toBe(false)
    v2.destroy()
  })
})

describe("clear with fallback storage", () => {
  it("deletes from fallback driver too", async () => {
    const primary = makeDriver()
    const fallback = makeDriver()

    const fp = new FormPersist(makeConfig({ storage: primary, fallbackStorage: fallback }))
    await fp.saveAll({ x: 1 })
    // Manually plant a copy in fallback to ensure it gets cleared
    const raw = await primary.get("form-persist:test-form")
    await fallback.set("form-persist:test-form", raw!)

    await fp.clear("manual")
    expect(await primary.get("form-persist:test-form")).toBeNull()
    expect(await fallback.get("form-persist:test-form")).toBeNull()
    fp.destroy()
  })
})

describe("timeRemaining edge cases", () => {
  it("returns 0 when data has already expired", async () => {
    jest.useRealTimers()
    const fp = new FormPersist(makeConfig({ ttl: 1 }))
    await fp.saveAll({ x: 1 })
    await new Promise((r) => setTimeout(r, 10))
    expect(await fp.timeRemaining()).toBe(0)
    fp.destroy()
  })
})

describe("getInfo when data is expired", () => {
  it("returns exists: false for expired data", async () => {
    jest.useRealTimers()
    const fp = new FormPersist(makeConfig({ ttl: 1 }))
    await fp.saveAll({ x: 1 })
    await new Promise((r) => setTimeout(r, 10))
    const info = await fp.getInfo()
    expect(info!.exists).toBe(false)
    fp.destroy()
  })
})

describe("_readRaw with fallback driver", () => {
  it("returns data from fallback when primary is empty", async () => {
    const primary = makeDriver()
    const fallback = makeDriver()

    const seed = new FormPersist(makeConfig({ storage: fallback }))
    await seed.saveAll({ src: "fallback" })
    seed.destroy()

    const fp = new FormPersist(makeConfig({ storage: primary, fallbackStorage: fallback }))
    expect(await fp.hasData()).toBe(true)
    fp.destroy()
  })
})

// ── error catch paths ─────────────────────────────────────────────────────────

describe("error catch paths — storage throws", () => {
  it("hasData returns false when driver.get throws", async () => {
    const driver = makeDriver()
    const onError = jest.fn()
    const fp = new FormPersist(makeConfig({ storage: driver, onError }))
    jest.spyOn(driver, "get").mockRejectedValue(new Error("storage error"))
    expect(await fp.hasData()).toBe(false)
    fp.destroy()
  })

  it("completeStep calls onError when driver.set throws", async () => {
    const driver = makeDriver()
    const onError = jest.fn()
    const fp = new FormPersist(makeConfig({ storage: driver, onError, steps: 3 }))
    // Seed some data first (so _loadRawForm can succeed before set fails)
    await fp.saveAll({ existing: true })
    jest.spyOn(driver, "set").mockRejectedValue(new Error("disk full"))
    await fp.completeStep(0, { a: 1 })
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    fp.destroy()
  })

  it("clear calls onError when driver.delete throws", async () => {
    const driver = makeDriver()
    const onError = jest.fn()
    const fp = new FormPersist(makeConfig({ storage: driver, onError }))
    jest.spyOn(driver, "delete").mockRejectedValue(new Error("delete failed"))
    await fp.clear("manual")
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    fp.destroy()
  })

  it("clearStep calls onError when driver.set throws after load", async () => {
    const driver = makeDriver()
    const onError = jest.fn()
    const fp = new FormPersist(makeConfig({ storage: driver, onError, steps: 3 }))
    await fp.saveAll({ step: "zero" })
    jest.spyOn(driver, "set").mockRejectedValue(new Error("disk full"))
    await fp.clearStep(0)
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    fp.destroy()
  })

  it("reset calls onError when driver.set throws after load", async () => {
    const driver = makeDriver()
    const onError = jest.fn()
    const fp = new FormPersist(makeConfig({ storage: driver, onError, steps: 3 }))
    await fp.saveAll({ data: "here" })
    jest.spyOn(driver, "set").mockRejectedValue(new Error("disk full"))
    await fp.reset()
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    fp.destroy()
  })

  it("extendTTL calls onError when driver.set throws after load", async () => {
    const driver = makeDriver()
    const onError = jest.fn()
    const fp = new FormPersist(makeConfig({ storage: driver, onError }))
    await fp.saveAll({ data: "here" })
    jest.spyOn(driver, "set").mockRejectedValue(new Error("disk full"))
    await fp.extendTTL(3600000)
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    fp.destroy()
  })

  it("_loadRawForm returns null when driver.get throws inside a method call", async () => {
    const driver = makeDriver()
    const fp = new FormPersist(makeConfig({ storage: driver, steps: 3 }))
    // Mock get to throw — _loadRawForm used by clearStep/reset/timeRemaining/extendTTL
    jest.spyOn(driver, "get").mockRejectedValue(new Error("read error"))
    // clearStep: _loadRawForm returns null → returns early (no throw propagates)
    await expect(fp.clearStep(0)).resolves.toBeUndefined()
    // timeRemaining: _loadRawForm returns null → returns null
    await expect(fp.timeRemaining()).resolves.toBeNull()
    fp.destroy()
  })

  it("timeRemaining catch fires when _loadRawForm itself throws unexpectedly", async () => {
    const fp = new FormPersist(makeConfig())
    // _loadRawForm has its own try/catch so it never throws normally;
    // mock it to simulate a truly unexpected failure to cover the defensive catch in timeRemaining
    jest.spyOn(fp as unknown as Record<string, unknown>, "_loadRawForm" as never)
      .mockRejectedValue(new Error("unexpected internal error"))
    expect(await fp.timeRemaining()).toBeNull()
    fp.destroy()
  })
})

describe("_createDriver with unknown storage type", () => {
  it("throws for an unrecognised storage type string", () => {
    expect(() =>
      new FormPersist({ key: "t", ttl: "1h", storage: "no-such-driver" as never })
    ).toThrow("Unknown storage type")
  })
})

describe("_writeForm QuotaExceededError fallback", () => {
  it("calls onError when QuotaExceededError occurs and no fallback is available (Node: indexedDB undefined)", async () => {
    const driver = makeDriver()
    const quota = Object.assign(new Error("quota"), { name: "QuotaExceededError" })
    jest.spyOn(driver, "set").mockRejectedValue(quota)
    const onError = jest.fn()
    const fp = new FormPersist(makeConfig({ storage: driver, onError }))
    await fp.saveAll({ x: 1 })
    // In Node, typeof indexedDB === "undefined" → fallback is null → error re-thrown → onError fires
    expect(onError).toHaveBeenCalled()
    fp.destroy()
  })
})
