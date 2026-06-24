// ─── Core ────────────────────────────────────────────────────────────────────
export { FormPersist } from "./core/FormPersist"
export type { AttachOptions } from "./core/FormPersist"

// ─── Global utilities ────────────────────────────────────────────────────────
export { clearAllForms, clearForms, runCleanup } from "./globals"

// ─── Storage drivers ─────────────────────────────────────────────────────────
export { LocalStorageDriver } from "./storage/LocalStorageDriver"
export { SessionStorageDriver } from "./storage/SessionStorageDriver"
export { IndexedDBDriver } from "./storage/IndexedDBDriver"
export { MemoryDriver } from "./storage/MemoryDriver"
export { AsyncStorageDriver } from "./storage/AsyncStorageDriver"
export type { AsyncStorageCompat } from "./storage/AsyncStorageDriver"

// ─── Utilities ───────────────────────────────────────────────────────────────
export { deepMerge } from "./utils/merge"
export { sanitizeData } from "./utils/sanitize"
export { fingerprintForm } from "./utils/fingerprint"

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  FormPersistConfig,
  PersistedForm,
  PersistedStep,
  StorageDriver,
  StorageType,
  ClearReason,
  TTLString,
  FormInfo,
} from "./types"
