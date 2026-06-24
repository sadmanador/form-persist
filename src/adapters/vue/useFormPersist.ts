import { ref, onMounted, onUnmounted, readonly } from "vue"
import { FormPersist } from "../../core/FormPersist"
import type { FormPersistConfig, PersistedForm, FormInfo, ClearReason } from "../../types"

/**
 * Vue 3 composable for form persistence.
 *
 * @example
 * const { save, restore, clear, hasData, currentStep } = useFormPersist({
 *   key: "my-form", steps: 3, ttl: "24h"
 * })
 */
export function useFormPersist(config: FormPersistConfig) {
  const persist = new FormPersist(config)

  const currentStep = ref(0)
  const hasData = ref(false)
  const isRestored = ref(false)
  const timeRemaining = ref<number | null>(null)
  const info = ref<FormInfo | null>(null)

  onMounted(async () => {
    const has = await persist.hasData()
    hasData.value = has
    if (has) {
      currentStep.value = await persist.getCurrentStep()
      timeRemaining.value = await persist.timeRemaining()
      info.value = await persist.getInfo()
    }
  })

  onUnmounted(() => {
    persist.destroy()
  })

  async function save(stepIndex: number, data: Record<string, unknown>): Promise<void> {
    await persist.save(stepIndex, data)
    hasData.value = true
    currentStep.value = stepIndex
  }

  async function saveAll(data: Record<string, unknown>): Promise<void> {
    await persist.saveAll(data)
    hasData.value = true
  }

  async function restore(): Promise<PersistedForm | null> {
    const form = await persist.restore()
    if (form) {
      currentStep.value = form.currentStep
      isRestored.value = true
      hasData.value = true
    }
    return form
  }

  async function clear(
    reason: Extract<ClearReason, "manual" | "submit" | "logout"> = "manual"
  ): Promise<void> {
    await persist.clear(reason)
    hasData.value = false
    isRestored.value = false
  }

  async function reset(): Promise<void> {
    await persist.reset()
    currentStep.value = 0
    hasData.value = false
    isRestored.value = false
  }

  async function completeStep(
    stepIndex: number,
    data: Record<string, unknown>
  ): Promise<void> {
    await persist.completeStep(stepIndex, data)
    currentStep.value = stepIndex + 1
    hasData.value = true
  }

  return {
    save,
    saveAll,
    restore,
    clear,
    reset,
    completeStep,
    setStep: (step: number) => {
      currentStep.value = step
    },
    destroy: () => persist.destroy(),
    currentStep: readonly(currentStep),
    hasData: readonly(hasData),
    isRestored: readonly(isRestored),
    timeRemaining: readonly(timeRemaining),
    info: readonly(info),
  }
}
