import { decompress } from "./Compressor"
import type { PersistedForm, StorageDriver } from "../types"

const UNIT_MS: Record<string, number> = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

export function parseTTL(ttl: number | string | undefined): number {
  if (ttl === undefined) return DEFAULT_TTL_MS
  if (typeof ttl === "number") return ttl

  const match = /^(\d+)(m|h|d)$/.exec(ttl)
  if (!match) {
    throw new Error(
      `Invalid TTL "${ttl}". Use a number (ms) or shorthand: "30m", "2h", "24h", "7d".`
    )
  }
  return parseInt(match[1], 10) * UNIT_MS[match[2]]
}

export function isExpired(form: PersistedForm): boolean {
  return Date.now() > form.expiresAt
}

export function computeExpiresAt(ttlMs: number): number {
  return Date.now() + ttlMs
}

const STORAGE_PREFIX = "form-persist:"

export async function runGlobalCleanup(driver: StorageDriver): Promise<void> {
  try {
    const allKeys = await driver.keys(STORAGE_PREFIX)
    const now = Date.now()
    await Promise.all(
      allKeys.map(async (key) => {
        try {
          const raw = await driver.get(key)
          if (!raw) return
          const json = raw.startsWith("\x00") ? decompress(raw.slice(1)) : raw
          if (!json) return // decompression failed — leave for FormPersist.restore() to handle
          const parsed = JSON.parse(json) as PersistedForm
          if (parsed.expiresAt && now > parsed.expiresAt) {
            await driver.delete(key)
          }
        } catch {
          await driver.delete(key)
        }
      })
    )
  } catch {
    // Storage unavailable — skip silently
  }
}
