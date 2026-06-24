import { defineConfig } from "tsup"

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["cjs", "esm"],
    dts: true,
    treeshake: true,
    clean: true,
  },
  {
    entry: { react: "src/adapters/react/useFormPersist.ts" },
    format: ["cjs", "esm"],
    dts: true,
    treeshake: true,
  },
  {
    entry: { "react-native": "src/adapters/react/useFormPersistNative.ts" },
    format: ["cjs", "esm"],
    dts: true,
    treeshake: true,
  },
  {
    entry: { vue: "src/adapters/vue/useFormPersist.ts" },
    format: ["cjs", "esm"],
    dts: true,
    treeshake: true,
  },
  {
    entry: { angular: "src/adapters/angular/form-persist.service.ts" },
    format: ["cjs", "esm"],
    dts: true,
    treeshake: true,
  },
  {
    entry: { svelte: "src/adapters/svelte/formPersist.ts" },
    format: ["cjs", "esm"],
    dts: true,
    treeshake: true,
  },
])
