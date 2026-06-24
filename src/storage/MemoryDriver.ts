import type { StorageDriver } from "../types"

export class MemoryDriver implements StorageDriver {
  private readonly _store = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this._store.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this._store.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this._store.delete(key)
  }

  async keys(prefix: string): Promise<string[]> {
    return [...this._store.keys()].filter((k) => k.startsWith(prefix))
  }

  async clear(prefix: string): Promise<void> {
    for (const key of await this.keys(prefix)) {
      this._store.delete(key)
    }
  }
}
