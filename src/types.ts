/** Every reason a form's persisted data can be cleared */
export type ClearReason =
  | "submit"
  | "manual"
  | "reset"
  | "expired"
  | "logout"
  | "version-mismatch"

/** Human-readable TTL shorthand */
export type TTLString = `${number}m` | `${number}h` | `${number}d`

/** A single persisted step's data */
export interface PersistedStep {
  data: Record<string, unknown>
  completedAt?: number
  valid: boolean
}

/** The full data structure written to storage for one form */
export interface PersistedForm {
  key: string
  version: number
  currentStep: number
  totalSteps: number
  steps: Record<number, PersistedStep>
  createdAt: number
  updatedAt: number
  expiresAt: number
  checksum?: string
  encrypted: boolean
  compressed: boolean
  metadata?: Record<string, unknown>
}

/** Minimal interface any storage backend must implement */
export interface StorageDriver {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  keys(prefix: string): Promise<string[]>
  clear(prefix: string): Promise<void>
}

/** Named storage types for built-in drivers */
export type StorageType = "localStorage" | "sessionStorage" | "indexedDB" | "memory"

/** Metadata snapshot returned by form.getInfo() */
export interface FormInfo {
  exists: boolean
  currentStep: number
  totalSteps: number
  completedSteps: number[]
  createdAt: Date | null
  expiresAt: Date | null
  sizeBytes: number
  compressed: boolean
  encrypted: boolean
}

/** Full configuration passed to FormPersist constructor */
export interface FormPersistConfig {
  /** Unique identifier for this form in storage */
  key: string

  /** Storage backend — built-in name or a custom driver instance */
  storage?: StorageType | StorageDriver

  /** Fallback storage if primary storage is full */
  fallbackStorage?: StorageType | StorageDriver

  /** Time-to-live. Accepts ms number or shorthand ("30m","2h","24h","7d"). Default: "24h" */
  ttl?: number | TTLString

  /** Total number of steps for multi-step forms. Omit for single-step. */
  steps?: number

  /** Compress data before storage (default: true) */
  compress?: boolean

  /** Warn if saved data exceeds this size (e.g. "4MB") */
  maxSize?: string

  /** Encrypt field values with AES-GCM before storage (default: false) */
  encrypt?: boolean

  /** Encryption passphrase — required when encrypt is true */
  encryptionKey?: string

  /** Field names to never write to storage */
  exclude?: string[]

  /** Schema version — bump when form fields change to discard stale saves */
  version?: number

  /** Auto-clear after form.clear("submit") is called (default: true) */
  clearOnSubmit?: boolean

  /** Clear when the browser tab/window closes (default: false) */
  clearOnUnload?: boolean

  /** Clear when a "session-end" event fires on document (default: false) */
  clearOnSessionEnd?: boolean

  /** Debounce delay in ms for save() calls (default: 300) */
  debounce?: number

  /** Called after saved data is successfully restored */
  onRestore?: (data: PersistedForm) => void

  /** Called after each save */
  onSave?: (data: PersistedForm) => void

  /** Called when data expires */
  onExpire?: () => void

  /** Called whenever data is cleared, with the reason */
  onClear?: (reason: ClearReason) => void

  /** Called on any storage error */
  onError?: (error: Error) => void
}
