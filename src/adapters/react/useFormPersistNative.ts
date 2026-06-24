import { useRef } from "react"
import { AsyncStorageDriver } from "../../storage/AsyncStorageDriver"
import type { AsyncStorageCompat } from "../../storage/AsyncStorageDriver"
import { useFormPersist } from "./useFormPersist"
import type { UseFormPersistReturn } from "./useFormPersist"
import type { FormPersistConfig } from "../../types"

type NativeConfig = Omit<FormPersistConfig, "storage" | "fallbackStorage"> & {
  /** Pass your @react-native-async-storage/async-storage instance here */
  storage: AsyncStorageCompat
}

/**
 * React Native variant of useFormPersist.
 * Pass your AsyncStorage instance via the `storage` prop — this library
 * never imports @react-native-async-storage/async-storage directly.
 *
 * @example
 * import AsyncStorage from "@react-native-async-storage/async-storage"
 * const { save, restore, clear } = useFormPersistNative({ key: "my-form", storage: AsyncStorage, ttl: "48h" })
 */
export function useFormPersistNative(config: NativeConfig): UseFormPersistReturn {
  const driverRef = useRef<AsyncStorageDriver | null>(null)
  if (!driverRef.current) {
    driverRef.current = new AsyncStorageDriver(config.storage)
  }

  const { storage: _ignored, ...restConfig } = config

  return useFormPersist({
    ...restConfig,
    storage: driverRef.current,
  })
}
