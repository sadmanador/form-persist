import { IDBFactory } from "fake-indexeddb"
import { IndexedDBDriver } from "../../src/storage/IndexedDBDriver"

// ── Node environment (indexedDB unavailable) ──────────────────────────────────

describe("IndexedDBDriver — unavailable environment (Node)", () => {
  let driver: IndexedDBDriver

  beforeEach(() => {
    driver = new IndexedDBDriver()
  })

  it("get returns null when IndexedDB is unavailable", async () => {
    expect(await driver.get("any-key")).toBeNull()
  })

  it("set is a no-op when IndexedDB is unavailable", async () => {
    await expect(driver.set("k", "v")).resolves.toBeUndefined()
  })

  it("delete is a no-op when IndexedDB is unavailable", async () => {
    await expect(driver.delete("k")).resolves.toBeUndefined()
  })

  it("keys returns empty array when IndexedDB is unavailable", async () => {
    expect(await driver.keys("form-persist:")).toEqual([])
  })

  it("clear is a no-op when IndexedDB is unavailable", async () => {
    await expect(driver.clear("form-persist:")).resolves.toBeUndefined()
  })
})

// ── Available environment (fake-indexeddb) ────────────────────────────────────

describe("IndexedDBDriver — available environment (fake-indexeddb)", () => {
  beforeEach(() => {
    ;(global as unknown as Record<string, unknown>).indexedDB = new IDBFactory()
  })

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).indexedDB
  })

  it("set and get round-trip", async () => {
    const driver = new IndexedDBDriver()
    await driver.set("form-persist:test", "hello")
    const result = await driver.get("form-persist:test")
    expect(result).toBe("hello")
  })

  it("get returns null for a missing key", async () => {
    const driver = new IndexedDBDriver()
    const result = await driver.get("form-persist:missing")
    expect(result).toBeNull()
  })

  it("delete removes a stored key", async () => {
    const driver = new IndexedDBDriver()
    await driver.set("form-persist:to-delete", "bye")
    await driver.delete("form-persist:to-delete")
    const result = await driver.get("form-persist:to-delete")
    expect(result).toBeNull()
  })

  it("delete on missing key resolves without error", async () => {
    const driver = new IndexedDBDriver()
    await expect(driver.delete("form-persist:not-there")).resolves.toBeUndefined()
  })

  it("keys returns all keys matching the prefix", async () => {
    const driver = new IndexedDBDriver()
    await driver.set("form-persist:a", "1")
    await driver.set("form-persist:b", "2")
    await driver.set("other:c", "3")

    const result = await driver.keys("form-persist:")
    expect(result.sort()).toEqual(["form-persist:a", "form-persist:b"])
  })

  it("keys returns empty array when no keys match prefix", async () => {
    const driver = new IndexedDBDriver()
    await driver.set("other:x", "1")
    const result = await driver.keys("form-persist:")
    expect(result).toEqual([])
  })

  it("clear removes all keys matching the prefix", async () => {
    const driver = new IndexedDBDriver()
    await driver.set("form-persist:x", "1")
    await driver.set("form-persist:y", "2")
    await driver.set("other:z", "3")

    await driver.clear("form-persist:")

    expect(await driver.keys("form-persist:")).toEqual([])
    expect(await driver.get("other:z")).toBe("3")
  })

  it("reuses the cached _db on subsequent operations", async () => {
    const driver = new IndexedDBDriver()
    // First call opens the DB
    await driver.set("form-persist:first", "v1")
    // Second call reuses _db (covers `if (this._db) return` branch)
    await driver.set("form-persist:second", "v2")
    expect(await driver.get("form-persist:first")).toBe("v1")
    expect(await driver.get("form-persist:second")).toBe("v2")
  })

  it("concurrent _openDB calls share the same promise", async () => {
    const driver = new IndexedDBDriver()
    // Fire two concurrent writes — second call should hit `if (this._dbPromise)` branch
    await Promise.all([
      driver.set("form-persist:p1", "a"),
      driver.set("form-persist:p2", "b"),
    ])
    expect(await driver.get("form-persist:p1")).toBe("a")
    expect(await driver.get("form-persist:p2")).toBe("b")
  })

  it("overwrites an existing value on set", async () => {
    const driver = new IndexedDBDriver()
    await driver.set("form-persist:key", "original")
    await driver.set("form-persist:key", "updated")
    expect(await driver.get("form-persist:key")).toBe("updated")
  })
})

// ── Error paths (mocked indexedDB) ────────────────────────────────────────────

describe("IndexedDBDriver — error paths", () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).indexedDB
    jest.restoreAllMocks()
  })

  it("get returns null when _openDB rejects (onerror)", async () => {
    let capturedRequest: Record<string, unknown>
    ;(global as unknown as Record<string, unknown>).indexedDB = {
      open: jest.fn().mockImplementation(() => {
        capturedRequest = {
          result: null,
          error: new Error("open failed"),
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          onblocked: null,
        }
        return capturedRequest
      }),
    }

    const driver = new IndexedDBDriver()
    const promise = driver.get("form-persist:key")
    // Trigger onerror — driver assigned the handler after open() returned
    ;(capturedRequest!.onerror as (() => void))?.()
    await expect(promise).resolves.toBeNull()
  })

  it("get returns null when _openDB rejects (onblocked)", async () => {
    let capturedRequest: Record<string, unknown>
    ;(global as unknown as Record<string, unknown>).indexedDB = {
      open: jest.fn().mockImplementation(() => {
        capturedRequest = {
          result: null,
          error: null,
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          onblocked: null,
        }
        return capturedRequest
      }),
    }

    const driver = new IndexedDBDriver()
    const promise = driver.get("form-persist:key")
    ;(capturedRequest!.onblocked as (() => void))?.()
    await expect(promise).resolves.toBeNull()
  })

  it("delete resolves silently when _openDB rejects", async () => {
    let capturedRequest: Record<string, unknown>
    ;(global as unknown as Record<string, unknown>).indexedDB = {
      open: jest.fn().mockImplementation(() => {
        capturedRequest = {
          result: null,
          error: new Error("open failed"),
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          onblocked: null,
        }
        return capturedRequest
      }),
    }

    const driver = new IndexedDBDriver()
    const promise = driver.delete("form-persist:key")
    ;(capturedRequest!.onerror as (() => void))?.()
    await expect(promise).resolves.toBeUndefined()
  })

  it("keys returns empty array when _openDB rejects", async () => {
    let capturedRequest: Record<string, unknown>
    ;(global as unknown as Record<string, unknown>).indexedDB = {
      open: jest.fn().mockImplementation(() => {
        capturedRequest = {
          result: null,
          error: new Error("open failed"),
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          onblocked: null,
        }
        return capturedRequest
      }),
    }

    const driver = new IndexedDBDriver()
    const promise = driver.keys("form-persist:")
    ;(capturedRequest!.onerror as (() => void))?.()
    await expect(promise).resolves.toEqual([])
  })

  it("onupgradeneeded skips createObjectStore when store already exists", async () => {
    let capturedRequest: Record<string, unknown>
    const mockDb = {
      objectStoreNames: { contains: jest.fn().mockReturnValue(true) },
      createObjectStore: jest.fn(),
      onversionchange: null,
    }
    ;(global as unknown as Record<string, unknown>).indexedDB = {
      open: jest.fn().mockImplementation(() => {
        capturedRequest = {
          result: mockDb,
          error: null,
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          onblocked: null,
          transaction: null,
        }
        return capturedRequest
      }),
    }

    const driver = new IndexedDBDriver()
    // Start an operation to trigger _openDB
    const getPromise = driver.get("key")

    // Fire onupgradeneeded (store already exists — should not call createObjectStore)
    ;(capturedRequest!.onupgradeneeded as (() => void))?.()

    // Fire onsuccess so the driver finishes opening
    // We can't easily proceed since get() needs a real transaction,
    // so just let onerror clean up
    ;(capturedRequest!.onerror as (() => void))?.()
    await getPromise

    expect(mockDb.createObjectStore).not.toHaveBeenCalled()
  })

  it("onversionchange closes the db and resets _db reference", async () => {
    ;(global as unknown as Record<string, unknown>).indexedDB = new IDBFactory()

    const driver = new IndexedDBDriver()
    // Open the DB by doing an operation
    await driver.set("form-persist:vc", "1")

    // Access private _db via casting
    const driverAny = driver as unknown as { _db: IDBDatabase | null }
    expect(driverAny._db).not.toBeNull()

    // Simulate a versionchange event by calling the handler directly
    const db = driverAny._db!
    ;(db as unknown as { onversionchange: (() => void) | null }).onversionchange?.()

    expect(driverAny._db).toBeNull()
  })
})
