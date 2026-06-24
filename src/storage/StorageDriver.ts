// Re-export the StorageDriver interface as a named barrel so framework adapters
// and custom driver authors can import from "form-persist/storage" without
// touching the internal types file.
export type { StorageDriver } from "../types"
