import { parseTTL, isExpired, computeExpiresAt, runGlobalCleanup } from "../../src/core/Expiry"
import { MemoryDriver } from "../../src/storage/MemoryDriver"
import type { PersistedForm } from "../../src/types"

const COMPRESSED_MARKER = "\x00"

function makeForm(overrides: Partial<PersistedForm> = {}): PersistedForm {
  const now = Date.now()
  return {
    key: "test",
    version: 1,
    currentStep: 0,
    totalSteps: 1,
    steps: {},
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 60_000,
    encrypted: false,
    compressed: false,
    ...overrides,
  }
}

// ── parseTTL ──────────────────────────────────────────────────────────────────

describe("parseTTL", () => {
  it("returns default 24h when undefined", () => {
    expect(parseTTL(undefined)).toBe(24 * 60 * 60 * 1000)
  })

  it("passes numbers through unchanged", () => {
    expect(parseTTL(0)).toBe(0)
    expect(parseTTL(5000)).toBe(5000)
    expect(parseTTL(99999)).toBe(99999)
  })

  it("parses minute shorthand", () => {
    expect(parseTTL("30m")).toBe(30 * 60 * 1000)
    expect(parseTTL("1m")).toBe(60 * 1000)
  })

  it("parses hour shorthand", () => {
    expect(parseTTL("2h")).toBe(2 * 60 * 60 * 1000)
    expect(parseTTL("24h")).toBe(24 * 60 * 60 * 1000)
  })

  it("parses day shorthand", () => {
    expect(parseTTL("7d")).toBe(7 * 24 * 60 * 60 * 1000)
    expect(parseTTL("1d")).toBe(24 * 60 * 60 * 1000)
  })

  it("throws on invalid string", () => {
    expect(() => parseTTL("forever")).toThrow(/Invalid TTL/)
    expect(() => parseTTL("24")).toThrow(/Invalid TTL/)
    expect(() => parseTTL("1y")).toThrow(/Invalid TTL/)
  })
})

// ── isExpired ─────────────────────────────────────────────────────────────────

describe("isExpired", () => {
  it("returns false when expiresAt is in the future", () => {
    const form = makeForm({ expiresAt: Date.now() + 100_000 })
    expect(isExpired(form)).toBe(false)
  })

  it("returns true when expiresAt is in the past", () => {
    const form = makeForm({ expiresAt: Date.now() - 1 })
    expect(isExpired(form)).toBe(true)
  })
})

// ── computeExpiresAt ──────────────────────────────────────────────────────────

describe("computeExpiresAt", () => {
  it("returns approximately now + ttlMs", () => {
    const before = Date.now()
    const result = computeExpiresAt(60_000)
    const after = Date.now()
    expect(result).toBeGreaterThanOrEqual(before + 60_000)
    expect(result).toBeLessThanOrEqual(after + 60_000)
  })

  it("handles 0 TTL (session-like)", () => {
    const before = Date.now()
    const result = computeExpiresAt(0)
    expect(result).toBeGreaterThanOrEqual(before)
    expect(result).toBeLessThanOrEqual(Date.now())
  })
})

// ── runGlobalCleanup ──────────────────────────────────────────────────────────

describe("runGlobalCleanup", () => {
  async function seedDriver(
    driver: MemoryDriver,
    entries: Array<{ key: string; form: PersistedForm; compressed?: boolean }>
  ) {
    for (const { key, form, compressed } of entries) {
      const json = JSON.stringify(form)
      await driver.set(key, compressed ? COMPRESSED_MARKER + json : json)
    }
  }

  it("deletes expired entries", async () => {
    const driver = new MemoryDriver()
    const expired = makeForm({ expiresAt: Date.now() - 1000 })
    await seedDriver(driver, [{ key: "form-persist:old", form: expired }])

    await runGlobalCleanup(driver)

    expect(await driver.get("form-persist:old")).toBeNull()
  })

  it("keeps non-expired entries", async () => {
    const driver = new MemoryDriver()
    const fresh = makeForm({ expiresAt: Date.now() + 100_000 })
    await seedDriver(driver, [{ key: "form-persist:fresh", form: fresh }])

    await runGlobalCleanup(driver)

    expect(await driver.get("form-persist:fresh")).not.toBeNull()
  })

  it("handles compressed entries correctly", async () => {
    const driver = new MemoryDriver()
    const fresh = makeForm({ expiresAt: Date.now() + 100_000 })
    await seedDriver(driver, [{ key: "form-persist:c", form: fresh, compressed: true }])

    await runGlobalCleanup(driver)

    expect(await driver.get("form-persist:c")).not.toBeNull()
  })

  it("deletes corrupted entries (JSON parse failure)", async () => {
    const driver = new MemoryDriver()
    await driver.set("form-persist:corrupt", "this-is-not-json")

    await runGlobalCleanup(driver)

    expect(await driver.get("form-persist:corrupt")).toBeNull()
  })

  it("ignores keys not matching the prefix", async () => {
    const driver = new MemoryDriver()
    await driver.set("other:key", '{"expiresAt":0}')

    await runGlobalCleanup(driver)

    expect(await driver.get("other:key")).not.toBeNull()
  })

  it("handles empty storage gracefully", async () => {
    const driver = new MemoryDriver()
    await expect(runGlobalCleanup(driver)).resolves.toBeUndefined()
  })

  it("deletes multiple expired, keeps multiple fresh", async () => {
    const driver = new MemoryDriver()
    const expired1 = makeForm({ expiresAt: Date.now() - 5000 })
    const expired2 = makeForm({ expiresAt: Date.now() - 1 })
    const fresh1 = makeForm({ expiresAt: Date.now() + 100_000 })
    const fresh2 = makeForm({ expiresAt: Date.now() + 200_000 })
    await seedDriver(driver, [
      { key: "form-persist:e1", form: expired1 },
      { key: "form-persist:e2", form: expired2 },
      { key: "form-persist:f1", form: fresh1 },
      { key: "form-persist:f2", form: fresh2 },
    ])

    await runGlobalCleanup(driver)

    expect(await driver.get("form-persist:e1")).toBeNull()
    expect(await driver.get("form-persist:e2")).toBeNull()
    expect(await driver.get("form-persist:f1")).not.toBeNull()
    expect(await driver.get("form-persist:f2")).not.toBeNull()
  })
})
