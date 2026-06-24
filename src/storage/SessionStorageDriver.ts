import type { StorageDriver } from "../types"

export class SessionStorageDriver implements StorageDriver {
  private _isAvailable(): boolean {
    if (typeof window === "undefined") return false
    try {
      const key = "__fp_test__"
      window.sessionStorage.setItem(key, key)
      window.sessionStorage.removeItem(key)
      return true
    } catch {
      return false
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this._isAvailable()) return null
    return window.sessionStorage.getItem(key)
  }

  async set(key: string, value: string): Promise<void> {
    if (!this._isAvailable()) return
    window.sessionStorage.setItem(key, value)
  }

  async delete(key: string): Promise<void> {
    if (!this._isAvailable()) return
    window.sessionStorage.removeItem(key)
  }

  async keys(prefix: string): Promise<string[]> {
    if (!this._isAvailable()) return []
    const result: string[] = []
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i)
      if (k && k.startsWith(prefix)) result.push(k)
    }
    return result
  }

  async clear(prefix: string): Promise<void> {
    const toDelete = await this.keys(prefix)
    for (const k of toDelete) window.sessionStorage.removeItem(k)
  }
}
