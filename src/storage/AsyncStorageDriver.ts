import type { StorageDriver } from "../types"

// Minimal interface that @react-native-async-storage/async-storage satisfies.
// The user passes the AsyncStorage instance — this library never imports it directly,
// keeping React Native an optional peer dependency.
export interface AsyncStorageCompat {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  getAllKeys(): Promise<readonly string[] | string[]>
  multiRemove(keys: string[]): Promise<void>
}

export class AsyncStorageDriver implements StorageDriver {
  private readonly _storage: AsyncStorageCompat

  constructor(storage: AsyncStorageCompat) {
    this._storage = storage
  }

  async get(key: string): Promise<string | null> {
    return this._storage.getItem(key)
  }

  async set(key: string, value: string): Promise<void> {
    return this._storage.setItem(key, value)
  }

  async delete(key: string): Promise<void> {
    return this._storage.removeItem(key)
  }

  async keys(prefix: string): Promise<string[]> {
    const allKeys = await this._storage.getAllKeys()
    return [...allKeys].filter((k) => k.startsWith(prefix))
  }

  async clear(prefix: string): Promise<void> {
    const toDelete = await this.keys(prefix)
    if (toDelete.length > 0) {
      await this._storage.multiRemove(toDelete)
    }
  }
}
