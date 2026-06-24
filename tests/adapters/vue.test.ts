import { useFormPersist } from "../../src/adapters/vue/useFormPersist"
import { MemoryDriver } from "../../src/storage/MemoryDriver"
import type { FormPersistConfig } from "../../src/types"
import { isRef } from "vue"

// Vue lifecycle hooks (onMounted / onUnmounted) emit warnings when called
// outside a component instance — expected in unit tests that exercise the
// composable directly without mounting a component.
beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {})
})

afterAll(() => {
  jest.restoreAllMocks()
})

function makeConfig(overrides: Partial<FormPersistConfig> = {}): FormPersistConfig {
  return {
    key: "vue-test-form",
    ttl: "24h",
    storage: new MemoryDriver(),
    ...overrides,
  }
}

// ── initial state ─────────────────────────────────────────────────────────────

describe("useFormPersist (Vue) — initial state", () => {
  it("returns reactive refs", () => {
    const { hasData, currentStep, isRestored, timeRemaining, info } =
      useFormPersist(makeConfig())

    expect(isRef(hasData)).toBe(true)
    expect(isRef(currentStep)).toBe(true)
    expect(isRef(isRestored)).toBe(true)
    expect(isRef(timeRemaining)).toBe(true)
    expect(isRef(info)).toBe(true)
  })

  it("hasData starts false", () => {
    const { hasData } = useFormPersist(makeConfig())
    expect(hasData.value).toBe(false)
  })

  it("currentStep starts at 0", () => {
    const { currentStep } = useFormPersist(makeConfig())
    expect(currentStep.value).toBe(0)
  })

  it("isRestored starts false", () => {
    const { isRestored } = useFormPersist(makeConfig())
    expect(isRestored.value).toBe(false)
  })
})

// ── save / restore ────────────────────────────────────────────────────────────

describe("useFormPersist (Vue) — save and restore", () => {
  it("saveAll sets hasData to true", async () => {
    const { saveAll, hasData } = useFormPersist(makeConfig())
    await saveAll({ field: "value" })
    expect(hasData.value).toBe(true)
  })

  it("restore returns persisted form and sets isRestored", async () => {
    const driver = new MemoryDriver()
    const { saveAll } = useFormPersist(makeConfig({ storage: driver }))
    await saveAll({ name: "Alice" })

    const { restore, isRestored } = useFormPersist(makeConfig({ storage: driver }))
    const form = await restore()
    expect(form).not.toBeNull()
    expect(form!.steps[0].data).toEqual({ name: "Alice" })
    expect(isRestored.value).toBe(true)
  })

  it("restore updates currentStep", async () => {
    const driver = new MemoryDriver()
    const writer = useFormPersist(makeConfig({ storage: driver, steps: 4 }))
    await writer.completeStep(1, { b: 2 })

    const reader = useFormPersist(makeConfig({ storage: driver, steps: 4 }))
    await reader.restore()
    expect(reader.currentStep.value).toBe(2) // completeStep advances to 2
  })
})

// ── clear ─────────────────────────────────────────────────────────────────────

describe("useFormPersist (Vue) — clear", () => {
  it("sets hasData to false", async () => {
    const { saveAll, clear, hasData } = useFormPersist(makeConfig())
    await saveAll({ x: 1 })
    await clear("manual")
    expect(hasData.value).toBe(false)
  })

  it("sets isRestored to false", async () => {
    const driver = new MemoryDriver()
    const { saveAll } = useFormPersist(makeConfig({ storage: driver }))
    await saveAll({ x: 1 })

    const { restore, clear, isRestored } = useFormPersist(makeConfig({ storage: driver }))
    await restore()
    await clear("manual")
    expect(isRestored.value).toBe(false)
  })
})

// ── reset ─────────────────────────────────────────────────────────────────────

describe("useFormPersist (Vue) — reset", () => {
  it("resets currentStep to 0 and hasData to false", async () => {
    const { saveAll, reset, hasData, currentStep } = useFormPersist(
      makeConfig({ steps: 3 })
    )
    await saveAll({ x: 1 })
    await reset()
    expect(hasData.value).toBe(false)
    expect(currentStep.value).toBe(0)
  })
})

// ── completeStep ──────────────────────────────────────────────────────────────

describe("useFormPersist (Vue) — completeStep", () => {
  it("advances currentStep", async () => {
    const { completeStep, currentStep } = useFormPersist(makeConfig({ steps: 4 }))
    await completeStep(0, { a: 1 })
    expect(currentStep.value).toBe(1)
  })

  it("sets hasData to true", async () => {
    const { completeStep, hasData } = useFormPersist(makeConfig({ steps: 3 }))
    await completeStep(0, { x: 1 })
    expect(hasData.value).toBe(true)
  })
})

// ── expose functions ──────────────────────────────────────────────────────────

describe("useFormPersist (Vue) — exposed functions", () => {
  it("exposes save, saveAll, restore, clear, reset, completeStep, destroy", () => {
    const api = useFormPersist(makeConfig())
    expect(typeof api.save).toBe("function")
    expect(typeof api.saveAll).toBe("function")
    expect(typeof api.restore).toBe("function")
    expect(typeof api.clear).toBe("function")
    expect(typeof api.reset).toBe("function")
    expect(typeof api.completeStep).toBe("function")
    expect(typeof api.destroy).toBe("function")
  })

  it("destroy does not throw", () => {
    const { destroy } = useFormPersist(makeConfig())
    expect(() => destroy()).not.toThrow()
  })
})
