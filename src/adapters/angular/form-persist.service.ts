// Angular users: annotate this class with @Injectable({ providedIn: "root" })
// from "@angular/core" so Angular's DI system can inject it.
// This library does not import @angular/core directly to keep it an optional peer dep.
//
// Example NgModule setup:
//   import { FormPersistService } from "form-persist/angular"
//   providers: [{ provide: FormPersistService, useClass: FormPersistService }]
//
// Or if using standalone components with providedIn:"root":
//   Add @Injectable({ providedIn: "root" }) before the class declaration.

import { FormPersist } from "../../core/FormPersist"
import type { FormPersistConfig, PersistedForm, FormInfo, ClearReason } from "../../types"

export class FormPersistService {
  private _persist: FormPersist | null = null
  private _currentStep = 0

  get currentStep(): number {
    return this._currentStep
  }

  /**
   * Initialize the service for a specific form.
   * Call this in ngOnInit before any other method.
   */
  async init(config: FormPersistConfig): Promise<void> {
    this._persist?.destroy()
    this._persist = new FormPersist(config)
    const has = await this._persist.hasData()
    if (has) {
      this._currentStep = await this._persist.getCurrentStep()
    }
  }

  private _assertInit(): FormPersist {
    if (!this._persist) {
      throw new Error("form-persist: Call init() before using FormPersistService")
    }
    return this._persist
  }

  async save(stepIndex: number, data: Record<string, unknown>): Promise<void> {
    await this._assertInit().save(stepIndex, data)
    this._currentStep = stepIndex
  }

  async saveAll(data: Record<string, unknown>): Promise<void> {
    await this._assertInit().saveAll(data)
  }

  async restore(): Promise<PersistedForm | null> {
    const form = await this._assertInit().restore()
    if (form) this._currentStep = form.currentStep
    return form
  }

  async completeStep(stepIndex: number, data: Record<string, unknown>): Promise<void> {
    await this._assertInit().completeStep(stepIndex, data)
    this._currentStep = stepIndex + 1
  }

  async clear(
    reason: Extract<ClearReason, "manual" | "submit" | "logout"> = "manual"
  ): Promise<void> {
    await this._assertInit().clear(reason)
  }

  async reset(): Promise<void> {
    await this._assertInit().reset()
    this._currentStep = 0
  }

  async hasData(): Promise<boolean> {
    return this._assertInit().hasData()
  }

  async timeRemaining(): Promise<number | null> {
    return this._assertInit().timeRemaining()
  }

  async getInfo(): Promise<FormInfo | null> {
    return this._assertInit().getInfo()
  }

  async extendTTL(additionalMs: number): Promise<void> {
    await this._assertInit().extendTTL(additionalMs)
  }

  /** Call in ngOnDestroy to release event listeners. */
  destroy(): void {
    this._persist?.destroy()
    this._persist = null
  }
}
