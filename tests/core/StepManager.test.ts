import { StepManager } from "../../src/core/StepManager"
import type { PersistedForm } from "../../src/types"

function makeForm(overrides: Partial<PersistedForm> = {}): PersistedForm {
  const now = Date.now()
  return {
    key: "test",
    version: 1,
    currentStep: 0,
    totalSteps: 4,
    steps: {},
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 86_400_000,
    encrypted: false,
    compressed: false,
    ...overrides,
  }
}

// ── saveStep ──────────────────────────────────────────────────────────────────

describe("StepManager.saveStep", () => {
  it("stores data at the given step index", () => {
    const mgr = new StepManager(makeForm())
    mgr.saveStep(1, { name: "Alice" })
    expect(mgr.getForm().steps[1].data).toEqual({ name: "Alice" })
  })

  it("marks valid=true by default", () => {
    const mgr = new StepManager(makeForm())
    mgr.saveStep(0, {})
    expect(mgr.getForm().steps[0].valid).toBe(true)
  })

  it("accepts explicit valid=false", () => {
    const mgr = new StepManager(makeForm())
    mgr.saveStep(0, {}, false)
    expect(mgr.getForm().steps[0].valid).toBe(false)
  })

  it("updates currentStep to the saved index", () => {
    const mgr = new StepManager(makeForm())
    mgr.saveStep(2, { x: 1 })
    expect(mgr.getForm().currentStep).toBe(2)
  })

  it("updates updatedAt", () => {
    const before = Date.now()
    const mgr = new StepManager(makeForm({ updatedAt: 0 }))
    mgr.saveStep(0, {})
    expect(mgr.getForm().updatedAt).toBeGreaterThanOrEqual(before)
  })

  it("overwrites previously saved step data", () => {
    const mgr = new StepManager(makeForm())
    mgr.saveStep(0, { name: "Old" })
    mgr.saveStep(0, { name: "New" })
    expect(mgr.getForm().steps[0].data).toEqual({ name: "New" })
  })

  it("does not set completedAt", () => {
    const mgr = new StepManager(makeForm())
    mgr.saveStep(0, {})
    expect(mgr.getForm().steps[0].completedAt).toBeUndefined()
  })
})

// ── completeStep ──────────────────────────────────────────────────────────────

describe("StepManager.completeStep", () => {
  it("sets completedAt timestamp", () => {
    const before = Date.now()
    const mgr = new StepManager(makeForm())
    mgr.completeStep(0, { a: 1 })
    expect(mgr.getForm().steps[0].completedAt).toBeGreaterThanOrEqual(before)
  })

  it("marks the step as valid", () => {
    const mgr = new StepManager(makeForm())
    mgr.completeStep(0, {})
    expect(mgr.getForm().steps[0].valid).toBe(true)
  })

  it("advances currentStep by one", () => {
    const mgr = new StepManager(makeForm({ currentStep: 0, totalSteps: 4 }))
    mgr.completeStep(0, {})
    expect(mgr.getForm().currentStep).toBe(1)
  })

  it("does not advance past totalSteps - 1", () => {
    const mgr = new StepManager(makeForm({ currentStep: 3, totalSteps: 4 }))
    mgr.completeStep(3, {})
    expect(mgr.getForm().currentStep).toBe(3)
  })

  it("stores data in the completed step", () => {
    const mgr = new StepManager(makeForm())
    mgr.completeStep(1, { field: "value" })
    expect(mgr.getForm().steps[1].data).toEqual({ field: "value" })
  })

  it("updates updatedAt", () => {
    const before = Date.now()
    const mgr = new StepManager(makeForm({ updatedAt: 0 }))
    mgr.completeStep(0, {})
    expect(mgr.getForm().updatedAt).toBeGreaterThanOrEqual(before)
  })
})

// ── getCompletedSteps ─────────────────────────────────────────────────────────

describe("StepManager.getCompletedSteps", () => {
  it("returns empty array when no steps are completed", () => {
    const mgr = new StepManager(makeForm())
    mgr.saveStep(0, {})
    expect(mgr.getCompletedSteps()).toEqual([])
  })

  it("returns sorted list of completed step indices", () => {
    const mgr = new StepManager(makeForm())
    mgr.completeStep(2, {})
    mgr.completeStep(0, {})
    mgr.completeStep(1, {})
    expect(mgr.getCompletedSteps()).toEqual([0, 1, 2])
  })

  it("excludes steps that were saved but not completed", () => {
    const mgr = new StepManager(makeForm())
    mgr.saveStep(0, {})
    mgr.completeStep(1, {})
    expect(mgr.getCompletedSteps()).toEqual([1])
  })
})

// ── getStep ───────────────────────────────────────────────────────────────────

describe("StepManager.getStep", () => {
  it("returns the step when it exists", () => {
    const mgr = new StepManager(makeForm())
    mgr.saveStep(0, { x: 1 })
    expect(mgr.getStep(0)).toEqual({ data: { x: 1 }, valid: true })
  })

  it("returns null for a step that was never saved", () => {
    const mgr = new StepManager(makeForm())
    expect(mgr.getStep(3)).toBeNull()
  })
})

// ── reset ─────────────────────────────────────────────────────────────────────

describe("StepManager.reset", () => {
  it("clears all steps", () => {
    const mgr = new StepManager(makeForm())
    mgr.saveStep(0, { a: 1 })
    mgr.completeStep(1, { b: 2 })
    mgr.reset()
    expect(mgr.getForm().steps).toEqual({})
  })

  it("resets currentStep to 0", () => {
    const mgr = new StepManager(makeForm({ currentStep: 3 }))
    mgr.reset()
    expect(mgr.getForm().currentStep).toBe(0)
  })

  it("updates updatedAt", () => {
    const before = Date.now()
    const mgr = new StepManager(makeForm({ updatedAt: 0 }))
    mgr.reset()
    expect(mgr.getForm().updatedAt).toBeGreaterThanOrEqual(before)
  })
})
