import { writable } from "svelte/store"
import { FormPersist } from "../../core/FormPersist"
import type { FormPersistConfig, PersistedForm, FormInfo, ClearReason } from "../../types"

/**
 * Svelte store + action for form persistence.
 *
 * @example
 * const persist = formPersist({ key: "my-form", steps: 3, ttl: "24h" })
 *
 * // In template:
 * <form use:persist.action>...</form>
 *
 * // Subscribe to reactive state:
 * $persist.hasData    // boolean
 * $persist.currentStep  // number (use persist.currentStep store directly)
 */
export function formPersist(config: FormPersistConfig) {
  const persist = new FormPersist(config)

  const currentStep = writable(0)
  const hasData = writable(false)
  const isRestored = writable(false)
  const timeRemaining = writable<number | null>(null)
  const info = writable<FormInfo | null>(null)

  // Initialise reactive state from storage (async, runs on creation)
  void (async () => {
    const has = await persist.hasData()
    hasData.set(has)
    if (has) {
      currentStep.set(await persist.getCurrentStep())
      timeRemaining.set(await persist.timeRemaining())
      info.set(await persist.getInfo())
    }
  })()

  async function save(stepIndex: number, data: Record<string, unknown>): Promise<void> {
    await persist.save(stepIndex, data)
    hasData.set(true)
    currentStep.set(stepIndex)
  }

  async function saveAll(data: Record<string, unknown>): Promise<void> {
    await persist.saveAll(data)
    hasData.set(true)
  }

  async function restore(): Promise<PersistedForm | null> {
    const form = await persist.restore()
    if (form) {
      currentStep.set(form.currentStep)
      isRestored.set(true)
      hasData.set(true)
    }
    return form
  }

  async function clear(
    reason: Extract<ClearReason, "manual" | "submit" | "logout"> = "manual"
  ): Promise<void> {
    await persist.clear(reason)
    hasData.set(false)
    isRestored.set(false)
  }

  async function reset(): Promise<void> {
    await persist.reset()
    currentStep.set(0)
    hasData.set(false)
    isRestored.set(false)
  }

  async function completeStep(
    stepIndex: number,
    data: Record<string, unknown>
  ): Promise<void> {
    await persist.completeStep(stepIndex, data)
    currentStep.update((s) => Math.min(s + 1, (config.steps ?? 1) - 1))
    hasData.set(true)
  }

  // Svelte action — attach to a <form> element via use:persist.action
  function action(node: HTMLFormElement) {
    const handleChange = () => {
      const data: Record<string, unknown> = {}
      new FormData(node).forEach((v, k) => {
        data[k] = v
      })
      void persist.saveAll(data)
      hasData.set(true)
    }

    node.addEventListener("input", handleChange)
    node.addEventListener("change", handleChange)

    if (config.clearOnSubmit !== false) {
      const handleSubmit = () => void persist.clear("submit").then(() => hasData.set(false))
      node.addEventListener("submit", handleSubmit)
      void restore()
      return {
        destroy() {
          node.removeEventListener("input", handleChange)
          node.removeEventListener("change", handleChange)
          node.removeEventListener("submit", handleSubmit)
          persist.destroy()
        },
      }
    }

    void restore()
    return {
      destroy() {
        node.removeEventListener("input", handleChange)
        node.removeEventListener("change", handleChange)
        persist.destroy()
      },
    }
  }

  return {
    save,
    saveAll,
    restore,
    clear,
    reset,
    completeStep,
    setStep: (step: number) => currentStep.set(step),
    currentStep,
    hasData,
    isRestored,
    timeRemaining,
    info,
    action,
    destroy: () => persist.destroy(),
  }
}
