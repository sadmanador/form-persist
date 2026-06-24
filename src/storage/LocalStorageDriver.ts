import type { StorageDriver } from "../types"

// localStorage quota is typically 5MB per origin.
// Writes that exceed it throw a QuotaExceededError (code 22) or a
// NS_ERROR_DOM_QUOTA_REACHED DOMException depending on the browser.
// FormPersist._writeForm() catches these and retries with the fallback driver.
const SOFT_WARN_BYTES = 4 * 1024 * 1024 // 4MB — warn before hitting the hard limit

export function isQuotaError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  return (
    e.name === "QuotaExceededError" ||
    e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    (e instanceof DOMException && e.code === 22)
  )
}

export class LocalStorageDriver implements StorageDriver {
  private _available: boolean | null = null

  private _isAvailable(): boolean {
    if (this._available !== null) return this._available
    if (typeof window === "undefined") {
      this._available = false
      return false
    }
    try {
      const key = "__fp_test__"
      window.localStorage.setItem(key, key)
      window.localStorage.removeItem(key)
      this._available = true
    } catch {
      this._available = false
    }
    return this._available
  }

  async get(key: string): Promise<string | null> {
    if (!this._isAvailable()) return null
    return window.localStorage.getItem(key)
  }

  async set(key: string, value: string): Promise<void> {
    if (!this._isAvailable()) return

    if (value.length > SOFT_WARN_BYTES && typeof console !== "undefined") {
      console.warn(
        `form-persist: value for "${key}" is ${(value.length / 1024 / 1024).toFixed(1)}MB — ` +
          `consider switching to storage: "indexedDB" for large data.`
      )
    }

    // Let QuotaExceededError propagate so FormPersist can activate fallback storage
    window.localStorage.setItem(key, value)
  }

  async delete(key: string): Promise<void> {
    if (!this._isAvailable()) return
    window.localStorage.removeItem(key)
  }

  async keys(prefix: string): Promise<string[]> {
    if (!this._isAvailable()) return []
    const result: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(prefix)) result.push(k)
    }
    return result
  }

  async clear(prefix: string): Promise<void> {
    const toDelete = await this.keys(prefix)
    for (const k of toDelete) window.localStorage.removeItem(k)
  }
}
