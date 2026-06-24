import type { StorageDriver } from "../types"

const DB_NAME = "form-persist"
const DB_VERSION = 1
const STORE_NAME = "forms"

function isIDBAvailable(): boolean {
  return typeof indexedDB !== "undefined"
}

export class IndexedDBDriver implements StorageDriver {
  private _db: IDBDatabase | null = null
  private _dbPromise: Promise<IDBDatabase> | null = null

  private _openDB(): Promise<IDBDatabase> {
    if (this._db) return Promise.resolve(this._db)
    if (this._dbPromise) return this._dbPromise

    this._dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME)
        }
      }

      request.onsuccess = () => {
        this._db = request.result
        this._dbPromise = null

        this._db.onversionchange = () => {
          this._db?.close()
          this._db = null
        }

        resolve(this._db)
      }

      request.onerror = () => {
        this._dbPromise = null
        reject(request.error ?? new Error("IndexedDB open failed"))
      }

      request.onblocked = () => {
        this._dbPromise = null
        reject(new Error("IndexedDB is blocked by another open connection"))
      }
    })

    return this._dbPromise
  }

  async get(key: string): Promise<string | null> {
    if (!isIDBAvailable()) return null
    try {
      const db = await this._openDB()
      return new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly")
        const req = tx.objectStore(STORE_NAME).get(key)
        req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
        req.onerror = () => reject(req.error)
      })
    } catch {
      return null
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (!isIDBAvailable()) return
    const db = await this._openDB()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const req = tx.objectStore(STORE_NAME).put(value, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  async delete(key: string): Promise<void> {
    if (!isIDBAvailable()) return
    try {
      const db = await this._openDB()
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite")
        const req = tx.objectStore(STORE_NAME).delete(key)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    } catch {
      // If DB can't be opened, there's nothing to delete
    }
  }

  async keys(prefix: string): Promise<string[]> {
    if (!isIDBAvailable()) return []
    try {
      const db = await this._openDB()
      return new Promise<string[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly")
        const req = tx.objectStore(STORE_NAME).getAllKeys()
        req.onsuccess = () => {
          const allKeys = req.result as IDBValidKey[]
          resolve(
            allKeys
              .filter((k): k is string => typeof k === "string" && k.startsWith(prefix))
          )
        }
        req.onerror = () => reject(req.error)
      })
    } catch {
      return []
    }
  }

  async clear(prefix: string): Promise<void> {
    const toDelete = await this.keys(prefix)
    await Promise.all(toDelete.map((k) => this.delete(k)))
  }
}
