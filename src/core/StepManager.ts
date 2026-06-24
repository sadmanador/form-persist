import type { PersistedForm, PersistedStep } from "../types"

export class StepManager {
  private readonly _form: PersistedForm

  constructor(form: PersistedForm) {
    this._form = form
  }

  getForm(): PersistedForm {
    return this._form
  }

  getCurrentStep(): number {
    return this._form.currentStep
  }

  saveStep(stepIndex: number, data: Record<string, unknown>, valid = true): void {
    this._form.steps[stepIndex] = { data, valid }
    this._form.currentStep = stepIndex
    this._form.updatedAt = Date.now()
  }

  completeStep(stepIndex: number, data: Record<string, unknown>): void {
    this._form.steps[stepIndex] = {
      data,
      valid: true,
      completedAt: Date.now(),
    }
    this._form.currentStep = Math.min(stepIndex + 1, this._form.totalSteps - 1)
    this._form.updatedAt = Date.now()
  }

  getStep(stepIndex: number): PersistedStep | null {
    return this._form.steps[stepIndex] ?? null
  }

  getCompletedSteps(): number[] {
    return Object.entries(this._form.steps)
      .filter(([, step]) => step.completedAt !== undefined)
      .map(([i]) => parseInt(i, 10))
      .sort((a, b) => a - b)
  }

  reset(): void {
    this._form.steps = {}
    this._form.currentStep = 0
    this._form.updatedAt = Date.now()
  }
}
