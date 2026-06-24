import { useState, useRef, useCallback, useEffect } from "react"
import { FormPersist } from "../../core/FormPersist"
import type { FormPersistConfig, PersistedForm, FormInfo, ClearReason } from "../../types"

export interface UseFormPersistReturn {
  save: (stepIndex: number, data: Record<string, unknown>) => Promise<void>
  saveAll: (data: Record<string, unknown>) => Promise<void>
  restore: () => Promise<PersistedForm | null>
  clear: (reason?: Extract<ClearReason, "manual" | "submit" | "logout">) => Promise<void>
  reset: () => Promise<void>
  completeStep: (stepIndex: number, data: Record<string, unknown>) => Promise<void>
  currentStep: number
  setStep: (step: number) => void
  hasData: boolean
  isRestored: boolean
  timeRemaining: number | null
  info: FormInfo | null
}

export function useFormPersist(config: FormPersistConfig): UseFormPersistReturn {
  // Stable callback refs — always current without recreating the FormPersist instance
  const onRestoreRef = useRef(config.onRestore)
  const onSaveRef = useRef(config.onSave)
  const onExpireRef = useRef(config.onExpire)
  const onClearRef = useRef(config.onClear)
  const onErrorRef = useRef(config.onError)
  onRestoreRef.current = config.onRestore
  onSaveRef.current = config.onSave
  onExpireRef.current = config.onExpire
  onClearRef.current = config.onClear
  onErrorRef.current = config.onError

  // Create FormPersist once per component mount
  const persistRef = useRef<FormPersist | null>(null)
  if (!persistRef.current) {
    persistRef.current = new FormPersist({
      ...config,
      onRestore: (data) => onRestoreRef.current?.(data),
      onSave: (data) => onSaveRef.current?.(data),
      onExpire: () => onExpireRef.current?.(),
      onClear: (reason) => onClearRef.current?.(reason),
      onError: (err) => onErrorRef.current?.(err),
    })
  }

  const [currentStep, setCurrentStep] = useState(0)
  const [hasData, setHasData] = useState(false)
  const [isRestored, setIsRestored] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [info, setInfo] = useState<FormInfo | null>(null)

  useEffect(() => {
    const persist = persistRef.current!

    void (async () => {
      const has = await persist.hasData()
      setHasData(has)
      if (has) {
        setCurrentStep(await persist.getCurrentStep())
        setTimeRemaining(await persist.timeRemaining())
        setInfo(await persist.getInfo())
      }
    })()

    return () => {
      persist.destroy()
      persistRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (stepIndex: number, data: Record<string, unknown>) => {
    await persistRef.current!.save(stepIndex, data)
    setHasData(true)
    setCurrentStep(stepIndex)
  }, [])

  const saveAll = useCallback(async (data: Record<string, unknown>) => {
    await persistRef.current!.saveAll(data)
    setHasData(true)
  }, [])

  const restore = useCallback(async () => {
    const form = await persistRef.current!.restore()
    if (form) {
      setCurrentStep(form.currentStep)
      setIsRestored(true)
      setHasData(true)
    }
    return form
  }, [])

  const clear = useCallback(
    async (reason: Extract<ClearReason, "manual" | "submit" | "logout"> = "manual") => {
      await persistRef.current!.clear(reason)
      setHasData(false)
      setIsRestored(false)
    },
    []
  )

  const reset = useCallback(async () => {
    await persistRef.current!.reset()
    setCurrentStep(0)
    setHasData(false)
    setIsRestored(false)
  }, [])

  const completeStep = useCallback(
    async (stepIndex: number, data: Record<string, unknown>) => {
      await persistRef.current!.completeStep(stepIndex, data)
      setCurrentStep(stepIndex + 1)
      setHasData(true)
    },
    []
  )

  return {
    save,
    saveAll,
    restore,
    clear,
    reset,
    completeStep,
    currentStep,
    setStep: setCurrentStep,
    hasData,
    isRestored,
    timeRemaining,
    info,
  }
}
