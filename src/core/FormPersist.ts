import { parseTTL, isExpired, computeExpiresAt, runGlobalCleanup } from "./Expiry"
import { compress, decompress } from "./Compressor"
import { encryptFields, decryptFields } from "./Crypto"
import { StepManager } from "./StepManager"
import { MemoryDriver } from "../storage/MemoryDriver"
import { LocalStorageDriver, isQuotaError } from "../storage/LocalStorageDriver"
import { SessionStorageDriver } from "../storage/SessionStorageDriver"
import { IndexedDBDriver } from "../storage/IndexedDBDriver"
import { fingerprintForm } from "../utils/fingerprint"
import type {
  FormPersistConfig,
  PersistedForm,
  FormInfo,
  ClearReason,
  StorageDriver,
  StorageType,
} from "../types"

export interface AttachOptions {
  /** Override the save debounce (ms) for this attachment. Defaults to config.debounce. */
  debounce?: number
  /** Called when saved data is restored into the form on attach. */
  onRestore?: (data: PersistedForm) => void
}

const STORAGE_PREFIX = "form-persist:"
// Null byte — never appears at the start of valid JSON
const COMPRESSED_MARKER = "\x00"

function parseSizeBytes(size: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(KB|MB|GB)?$/i.exec(size.trim())
  if (!match) return Infinity
  const value = parseFloat(match[1])
  const unit = (match[2] ?? "B").toUpperCase()
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  }
  return value * (multipliers[unit] ?? 1)
}

export class FormPersist {
  private readonly _config: FormPersistConfig
  private readonly _driver: StorageDriver
  private readonly _fallbackDriver: StorageDriver | null
  private readonly _storageKey: string
  private readonly _ttlMs: number
  private readonly _debounceMs: number
  private readonly _maxSizeBytes: number

  // Debounce state for save()
  private _saveTimer: ReturnType<typeof setTimeout> | null = null
  private _pendingStepIndex: number | undefined
  private _pendingData: Record<string, unknown> | undefined
  private _pendingResolve: (() => void) | undefined
  private _pendingReject: ((e: Error) => void) | undefined

  // Event listener references for cleanup
  private _unloadHandler: (() => void) | null = null
  private _sessionEndHandler: (() => void) | null = null

  constructor(config: FormPersistConfig) {
    this._config = config
    this._ttlMs = parseTTL(config.ttl)
    this._storageKey = STORAGE_PREFIX + config.key
    this._debounceMs = config.debounce ?? 300
    this._maxSizeBytes = config.maxSize ? parseSizeBytes(config.maxSize) : Infinity
    this._driver = this._createDriver(config.storage)
    this._fallbackDriver = config.fallbackStorage
      ? this._createDriver(config.fallbackStorage)
      : null

    if (typeof window !== "undefined") {
      if (config.clearOnUnload) {
        this._unloadHandler = () => {
          void this.clear("manual")
        }
        window.addEventListener("beforeunload", this._unloadHandler)
      }
      if (config.clearOnSessionEnd) {
        this._sessionEndHandler = () => {
          void this.clear("logout")
        }
        document.addEventListener("session-end", this._sessionEndHandler)
      }
    }

    void runGlobalCleanup(this._driver)
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  save(stepIndex: number, data: Record<string, unknown>): Promise<void> {
    // Resolve any superseded pending save immediately
    if (this._pendingResolve) {
      this._pendingResolve()
    }
    if (this._saveTimer !== null) {
      clearTimeout(this._saveTimer)
    }

    return new Promise<void>((resolve, reject) => {
      this._pendingStepIndex = stepIndex
      this._pendingData = data
      this._pendingResolve = resolve
      this._pendingReject = reject

      this._saveTimer = setTimeout(() => {
        this._saveTimer = null
        const si = this._pendingStepIndex!
        const pd = this._pendingData!
        const res = this._pendingResolve!
        const rej = this._pendingReject!
        this._pendingStepIndex = undefined
        this._pendingData = undefined
        this._pendingResolve = undefined
        this._pendingReject = undefined
        this._executeSave(si, pd).then(res).catch(rej)
      }, this._debounceMs)
    })
  }

  async saveAll(data: Record<string, unknown>): Promise<void> {
    return this._executeSave(0, data)
  }

  async restore(): Promise<PersistedForm | null> {
    try {
      const raw = await this._readRaw()
      if (!raw) return null

      const form = this._deserialize(raw)
      if (!form) return null

      if (form.version !== (this._config.version ?? 1)) {
        await this._deleteAndNotify("version-mismatch")
        return null
      }

      if (isExpired(form)) {
        await this._deleteAndNotify("expired")
        return null
      }

      if (form.encrypted && this._config.encryptionKey) {
        for (const idx of Object.keys(form.steps)) {
          const i = Number(idx)
          form.steps[i].data = await decryptFields(
            form.steps[i].data,
            this._config.encryptionKey,
            this._config.exclude ?? []
          )
        }
      }

      this._config.onRestore?.(form)
      return form
    } catch (e) {
      this._handleError(e)
      return null
    }
  }

  async restoreStep(stepIndex: number): Promise<Record<string, unknown> | null> {
    const form = await this.restore()
    if (!form) return null
    return form.steps[stepIndex]?.data ?? null
  }

  async completeStep(stepIndex: number, data: Record<string, unknown>): Promise<void> {
    try {
      const sanitized = this._sanitize(data)
      const existing = await this._loadRawForm()
      const form = existing ?? this._newForm()
      const mgr = new StepManager(form)

      const fieldData =
        this._config.encrypt && this._config.encryptionKey
          ? await encryptFields(sanitized, this._config.encryptionKey, this._config.exclude ?? [])
          : sanitized

      mgr.completeStep(stepIndex, fieldData)
      await this._writeForm(mgr.getForm())
      this._config.onSave?.(mgr.getForm())
    } catch (e) {
      this._handleError(e)
    }
  }

  async getCurrentStep(): Promise<number> {
    const form = await this._loadRawForm()
    return form?.currentStep ?? 0
  }

  async hasData(): Promise<boolean> {
    try {
      const raw = await this._readRaw()
      if (!raw) return false
      const form = this._deserialize(raw)
      if (!form) return false
      if (form.version !== (this._config.version ?? 1)) return false
      return !isExpired(form)
    } catch {
      return false
    }
  }

  async clear(reason: ClearReason = "manual"): Promise<void> {
    try {
      await this._driver.delete(this._storageKey)
      await this._fallbackDriver?.delete(this._storageKey)
      if (reason === "expired") {
        this._config.onExpire?.()
      }
      this._config.onClear?.(reason)
    } catch (e) {
      this._handleError(e)
    }
  }

  async clearStep(stepIndex: number): Promise<void> {
    try {
      const form = await this._loadRawForm()
      if (!form) return
      delete form.steps[stepIndex]
      form.updatedAt = Date.now()
      await this._writeForm(form)
    } catch (e) {
      this._handleError(e)
    }
  }

  async reset(): Promise<void> {
    try {
      const form = await this._loadRawForm()
      if (form) {
        const mgr = new StepManager(form)
        mgr.reset()
        await this._writeForm(mgr.getForm())
      } else {
        await this._driver.delete(this._storageKey)
        await this._fallbackDriver?.delete(this._storageKey)
      }
      this._config.onClear?.("reset")
    } catch (e) {
      this._handleError(e)
    }
  }

  async timeRemaining(): Promise<number | null> {
    try {
      const form = await this._loadRawForm()
      if (!form) return null
      const remaining = form.expiresAt - Date.now()
      return remaining > 0 ? remaining : 0
    } catch {
      return null
    }
  }

  async getInfo(): Promise<FormInfo | null> {
    try {
      const raw = await this._readRaw()
      if (!raw) {
        return {
          exists: false,
          currentStep: 0,
          totalSteps: this._config.steps ?? 1,
          completedSteps: [],
          createdAt: null,
          expiresAt: null,
          sizeBytes: 0,
          compressed: this._config.compress !== false,
          encrypted: this._config.encrypt ?? false,
        }
      }
      const form = this._deserialize(raw)
      if (!form || isExpired(form)) {
        return {
          exists: false,
          currentStep: 0,
          totalSteps: this._config.steps ?? 1,
          completedSteps: [],
          createdAt: null,
          expiresAt: null,
          sizeBytes: 0,
          compressed: form?.compressed ?? this._config.compress !== false,
          encrypted: form?.encrypted ?? (this._config.encrypt ?? false),
        }
      }
      const mgr = new StepManager(form)
      return {
        exists: true,
        currentStep: form.currentStep,
        totalSteps: form.totalSteps,
        completedSteps: mgr.getCompletedSteps(),
        createdAt: new Date(form.createdAt),
        expiresAt: new Date(form.expiresAt),
        sizeBytes: new TextEncoder().encode(raw).length,
        compressed: form.compressed,
        encrypted: form.encrypted,
      }
    } catch {
      return null
    }
  }

  async extendTTL(additionalMs: number): Promise<void> {
    try {
      const form = await this._loadRawForm()
      if (!form) return
      form.expiresAt = form.expiresAt + additionalMs
      form.updatedAt = Date.now()
      await this._writeForm(form)
    } catch (e) {
      this._handleError(e)
    }
  }

  /**
   * Attach form-persist to a plain HTML `<form>` element.
   * Restores saved values into form fields immediately, then saves on every input/change.
   * Returns a cleanup function — call it when you want to detach.
   *
   * @example
   * const detach = persist.attach(document.querySelector('#my-form'), {
   *   onRestore: (form) => console.log('restored', form),
   *   debounce: 500,
   * })
   * // later:
   * detach()
   */
  attach(
    formEl: HTMLFormElement,
    options: AttachOptions = {}
  ): () => void {
    const debounceMs = options.debounce ?? this._debounceMs

    // Restore data into form fields
    void this.restore().then((form) => {
      if (!form) return
      const stepData = form.steps[form.currentStep]?.data ?? {}
      for (const [name, value] of Object.entries(stepData)) {
        const el = formEl.elements.namedItem(name) as HTMLInputElement | null
        if (el && value != null) {
          el.value = String(value)
        }
      }
      options.onRestore?.(form)
    })

    let timer: ReturnType<typeof setTimeout> | null = null
    const handleChange = () => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        const data: Record<string, unknown> = {}
        new FormData(formEl).forEach((v, k) => {
          data[k] = v
        })
        void this.saveAll(data)
      }, debounceMs)
    }

    const handleSubmit = () => {
      if (this._config.clearOnSubmit !== false) {
        void this.clear("submit")
      }
    }

    formEl.addEventListener("input", handleChange)
    formEl.addEventListener("change", handleChange)
    formEl.addEventListener("submit", handleSubmit)

    return () => {
      if (timer !== null) clearTimeout(timer)
      formEl.removeEventListener("input", handleChange)
      formEl.removeEventListener("change", handleChange)
      formEl.removeEventListener("submit", handleSubmit)
    }
  }

  destroy(): void {
    if (this._saveTimer !== null) {
      clearTimeout(this._saveTimer)
      this._saveTimer = null
    }
    if (this._pendingResolve) {
      this._pendingResolve()
      this._pendingResolve = undefined
    }
    if (typeof window !== "undefined") {
      if (this._unloadHandler) {
        window.removeEventListener("beforeunload", this._unloadHandler)
      }
      if (this._sessionEndHandler) {
        document.removeEventListener("session-end", this._sessionEndHandler)
      }
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async _executeSave(
    stepIndex: number,
    rawData: Record<string, unknown>
  ): Promise<void> {
    try {
      const sanitized = this._sanitize(rawData)
      const existing = await this._loadRawForm()
      const form = existing ?? this._newForm()

      const fieldData =
        this._config.encrypt && this._config.encryptionKey
          ? await encryptFields(sanitized, this._config.encryptionKey, this._config.exclude ?? [])
          : sanitized

      const mgr = new StepManager(form)
      mgr.saveStep(stepIndex, fieldData)
      await this._writeForm(mgr.getForm())
      this._config.onSave?.(mgr.getForm())
    } catch (e) {
      this._handleError(e)
    }
  }

  /** Read the raw storage string, checking primary then fallback. */
  private async _readRaw(): Promise<string | null> {
    const primary = await this._driver.get(this._storageKey)
    if (primary) return primary
    if (this._fallbackDriver) {
      return this._fallbackDriver.get(this._storageKey)
    }
    return null
  }

  private async _loadRawForm(): Promise<PersistedForm | null> {
    try {
      const raw = await this._readRaw()
      if (!raw) return null
      return this._deserialize(raw)
    } catch {
      return null
    }
  }

  private async _writeForm(form: PersistedForm): Promise<void> {
    const serialized = this._serialize(form)

    if (serialized.length > this._maxSizeBytes && typeof console !== "undefined") {
      console.warn(
        `form-persist: Saved data for "${this._config.key}" ` +
          `(${(serialized.length / 1024).toFixed(0)}KB) exceeds maxSize limit.`
      )
    }

    try {
      await this._driver.set(this._storageKey, serialized)
    } catch (e) {
      if (isQuotaError(e)) {
        // Storage full — try fallback driver
        const fallback =
          this._fallbackDriver ??
          (typeof indexedDB !== "undefined" ? new IndexedDBDriver() : null)
        if (fallback) {
          await fallback.set(this._storageKey, serialized)
          return
        }
      }
      throw e
    }
  }

  private _serialize(form: PersistedForm): string {
    const json = JSON.stringify(form)
    if (this._config.compress !== false) {
      form.compressed = true
      return COMPRESSED_MARKER + compress(json)
    }
    return json
  }

  private _deserialize(raw: string): PersistedForm | null {
    try {
      let json: string
      if (raw.startsWith(COMPRESSED_MARKER)) {
        json = decompress(raw.slice(COMPRESSED_MARKER.length))
        if (!json) return null
      } else {
        json = raw
      }
      return JSON.parse(json) as PersistedForm
    } catch {
      return null
    }
  }

  private _sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const excluded = this._config.exclude
    if (!excluded?.length) return data
    const result = { ...data }
    for (const field of excluded) {
      delete result[field]
    }
    return result
  }

  private _newForm(): PersistedForm {
    const now = Date.now()
    return {
      key: this._config.key,
      version: this._config.version ?? 1,
      currentStep: 0,
      totalSteps: this._config.steps ?? 1,
      steps: {},
      createdAt: now,
      updatedAt: now,
      expiresAt: computeExpiresAt(this._ttlMs),
      encrypted: this._config.encrypt ?? false,
      compressed: this._config.compress !== false,
    }
  }

  private async _deleteAndNotify(reason: ClearReason): Promise<void> {
    await this._driver.delete(this._storageKey)
    await this._fallbackDriver?.delete(this._storageKey)
    if (reason === "expired") {
      this._config.onExpire?.()
    }
    this._config.onClear?.(reason)
  }

  private _handleError(e: unknown): void {
    const err = e instanceof Error ? e : new Error(String(e))
    this._config.onError?.(err)
  }

  private _createDriver(storage?: StorageType | StorageDriver): StorageDriver {
    if (storage && typeof storage === "object") {
      return storage as StorageDriver
    }

    const isSSR = typeof window === "undefined"
    const type = (storage as StorageType | undefined) ?? (isSSR ? "memory" : "localStorage")

    switch (type) {
      case "localStorage":
        return isSSR ? new MemoryDriver() : new LocalStorageDriver()
      case "sessionStorage":
        return isSSR ? new MemoryDriver() : new SessionStorageDriver()
      case "memory":
        return new MemoryDriver()
      case "indexedDB":
        return isSSR ? new MemoryDriver() : new IndexedDBDriver()
      default:
        throw new Error(`form-persist: Unknown storage type "${String(storage)}"`)
    }
  }
}
