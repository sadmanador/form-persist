import { runGlobalCleanup } from "./core/Expiry"
import { LocalStorageDriver } from "./storage/LocalStorageDriver"
import { MemoryDriver } from "./storage/MemoryDriver"
import type { StorageDriver } from "./types"

const STORAGE_PREFIX = "form-persist:"

function defaultDriver(storage?: StorageDriver): StorageDriver {
  if (storage) return storage
  return typeof window !== "undefined" ? new LocalStorageDriver() : new MemoryDriver()
}

/**
 * Clear ALL persisted form data across the entire app.
 * Call this on logout to wipe every form-persist:* key from storage.
 */
export async function clearAllForms(storage?: StorageDriver): Promise<void> {
  await defaultDriver(storage).clear(STORAGE_PREFIX)
}

/**
 * Clear persisted data for a named list of form keys only.
 *
 * @example
 * await clearForms(["vaccine-arrival", "patient-registration"])
 */
export async function clearForms(keys: string[], storage?: StorageDriver): Promise<void> {
  const driver = defaultDriver(storage)
  await Promise.all(keys.map((k) => driver.delete(STORAGE_PREFIX + k)))
}

/**
 * Scan storage and delete every form-persist:* entry whose TTL has expired.
 * Call this once on app init to keep storage tidy.
 */
export async function runCleanup(storage?: StorageDriver): Promise<void> {
  await runGlobalCleanup(defaultDriver(storage))
}
