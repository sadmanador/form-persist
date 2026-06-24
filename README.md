# form-persist

> Auto-save form state. Restore on return. Never lose a user's work again.
> Multi-step forms, large data, expiry, encryption. React, Vue, Angular, Svelte, React Native.

[![npm](https://img.shields.io/npm/v/form-persist)](https://www.npmjs.com/package/form-persist)
[![npm downloads](https://img.shields.io/npm/dm/form-persist)](https://www.npmjs.com/package/form-persist)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Coverage](https://img.shields.io/badge/coverage-%E2%89%A590%25-brightgreen)]()

---

## The Problem

The user fills out a long, multi-step form. They accidentally close the tab, the session times out, or the browser crashes. They come back to find a blank form and have to start over.

`form-persist` saves form state automatically as the user types and restores it when they return — with built-in expiry so sensitive data never lingers in storage.

---

## Installation

```bash
npm install form-persist
# yarn add form-persist
# pnpm add form-persist
# bun add form-persist
```

---

## Quick Start

### React

```tsx
import { useFormPersist } from "form-persist/react"

function ContactForm() {
  const [formData, setFormData] = useState({ name: "", email: "" })

  const { save, restore, clear, hasData, isRestored } = useFormPersist({
    key: "contact-form",
    ttl: "24h",
    clearOnSubmit: true,
    onRestore: (saved) => {
      const data = saved.steps[0]?.data
      if (data) setFormData(data)
    },
  })

  const handleChange = (e) => {
    const updated = { ...formData, [e.target.name]: e.target.value }
    setFormData(updated)
    save(0, updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    await submitToServer(formData)
    await clear("submit")
  }

  return (
    <div>
      {hasData && !isRestored && (
        <div>
          <p>You have a saved draft.</p>
          <button onClick={restore}>Continue</button>
          <button onClick={() => clear("manual")}>Discard</button>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <input name="name" value={formData.name} onChange={handleChange} />
        <input name="email" value={formData.email} onChange={handleChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}
```

### Plain HTML / Vanilla JS

```html
<script type="module">
  import { FormPersist } from "https://cdn.jsdelivr.net/npm/form-persist/dist/index.esm.js"

  const form = new FormPersist({ key: "my-form", ttl: "24h" })

  // Auto-attach: saves on every input, restores on load, clears on submit
  form.attach(document.querySelector("#my-form"))
</script>
```

---

## Multi-Step Forms

```tsx
const { save, completeStep, reset, currentStep, hasData, restore } = useFormPersist({
  key: "vaccine-report",
  steps: 4,
  ttl: "24h",
  clearOnSubmit: true,
  onRestore: (saved) => {
    // pre-fill your step state from saved.steps[saved.currentStep]
  },
})

// Save draft data for the active step (debounced 300 ms)
save(currentStep, stepData)

// Mark a step complete and advance to the next
await completeStep(currentStep, stepData)

// Reset to step 0 and clear all data
await reset()
```

---

## Data Expiry & Security

Persisted form data can contain sensitive information. `form-persist` enforces TTLs so data never lives in storage longer than it should.

### TTL options

```ts
ttl: "30m"   // 30 minutes  — short public-terminal sessions
ttl: "2h"    // 2 hours     — typical work session
ttl: "24h"   // 24 hours    — default; survives overnight
ttl: "7d"    // 7 days      — long multi-day form filling
```

### Clear triggers

```ts
// After successful submit (automatic when clearOnSubmit: true)
await form.clear("submit")

// User clicks "Start fresh"
await form.reset()

// On logout — wipe all form-persist data from storage
import { clearAllForms } from "form-persist"
await clearAllForms()

// Clean up expired entries on app init
import { runCleanup } from "form-persist"
await runCleanup()
```

### Excluding sensitive fields

```ts
useFormPersist({
  key: "payment-form",
  ttl: "2h",
  exclude: ["cardNumber", "cvv", "pin"],  // never written to storage
})
```

### Encryption

```ts
useFormPersist({
  key: "medical-form",
  ttl: "24h",
  encrypt: true,
  encryptionKey: process.env.FORM_ENCRYPT_KEY,  // AES-GCM 256-bit via Web Crypto API
})
```

### `onClear` callback

```ts
useFormPersist({
  key: "my-form",
  ttl: "24h",
  onClear: (reason) => {
    // reason: "submit" | "manual" | "reset" | "expired" | "logout" | "version-mismatch"
    if (reason === "expired") showToast("Your session expired.")
    if (reason === "submit") router.push("/thank-you")
  },
})
```

---

## API Reference

### `FormPersist` constructor options

| Option | Type | Default | Description |
|---|---|---|---|
| `key` | `string` | required | Unique form identifier |
| `ttl` | `TTLString \| number` | `"24h"` | Time-to-live (`"30m"`, `"2h"`, `"24h"`, `"7d"`, or ms) |
| `steps` | `number` | `1` | Total steps for multi-step forms |
| `storage` | `"localStorage" \| "sessionStorage" \| "indexedDB" \| "memory" \| StorageDriver` | `"localStorage"` | Where to persist data |
| `fallbackStorage` | same as `storage` | `undefined` | Used when primary storage is full |
| `compress` | `boolean` | `true` | LZ-string compress saved data |
| `encrypt` | `boolean` | `false` | AES-GCM 256-bit field encryption |
| `encryptionKey` | `string` | — | Required when `encrypt: true` |
| `exclude` | `string[]` | `[]` | Field names to never write to storage |
| `version` | `number` | `1` | Bump to discard stale saved data |
| `clearOnSubmit` | `boolean` | `true` | Auto-clear on `clear("submit")` |
| `clearOnUnload` | `boolean` | `false` | Clear on tab/window close |
| `clearOnSessionEnd` | `boolean` | `false` | Clear on custom `"session-end"` DOM event |
| `debounce` | `number` | `300` | Save debounce in ms |
| `maxSize` | `string` | — | Warn if serialized data exceeds this (e.g. `"4MB"`) |
| `onRestore` | `(form) => void` | — | Called when saved data is restored |
| `onSave` | `(form) => void` | — | Called after each save |
| `onExpire` | `() => void` | — | Called when data expires |
| `onClear` | `(reason) => void` | — | Called when data is cleared |
| `onError` | `(err) => void` | — | Called on storage errors |

### Core methods

```ts
form.save(stepIndex, data)          // debounced step save
form.saveAll(data)                  // immediate save to step 0
form.restore()                      // → PersistedForm | null
form.restoreStep(stepIndex)         // → Record | null
form.completeStep(stepIndex, data)  // mark done, advance currentStep
form.getCurrentStep()               // → number
form.hasData()                      // → boolean
form.clear(reason?)                 // delete saved data
form.clearStep(stepIndex)           // delete one step only
form.reset()                        // clear + return to step 0
form.timeRemaining()                // → ms until expiry | null
form.getInfo()                      // → FormInfo metadata
form.extendTTL(additionalMs)        // push expiry forward
form.attach(formEl, options?)       // plain-HTML auto-wiring → detach()
form.destroy()                      // remove event listeners
```

---

## Framework Guides

### React

```tsx
import { useFormPersist } from "form-persist/react"

const { save, saveAll, restore, clear, reset, completeStep,
        currentStep, setStep, hasData, isRestored, timeRemaining, info }
  = useFormPersist({ key: "my-form", ttl: "24h" })
```

### React Native

```tsx
import { useFormPersistNative } from "form-persist/react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

const { save, restore, clear, currentStep, completeStep, hasData }
  = useFormPersistNative({ key: "my-form", ttl: "48h", storage: AsyncStorage })
```

### Next.js (SSR safe)

Works out of the box — on the server it uses `MemoryDriver` (no-op); on the client it uses `localStorage`. No guards or dynamic imports needed.

```tsx
import { useFormPersist } from "form-persist/react"
```

### Vue 3

```ts
import { useFormPersist } from "form-persist/vue"

const { save, restore, clear, currentStep, completeStep, hasData, timeRemaining }
  = useFormPersist({ key: "my-form", steps: 3, ttl: "24h" })
```

### Angular

```ts
import { FormPersistService } from "form-persist/angular"

// inject in component
constructor(private formPersist: FormPersistService) {}

async ngOnInit() {
  await this.formPersist.init({ key: "my-form", ttl: "24h" })
  const saved = await this.formPersist.restore()
}
```

### Svelte / SvelteKit

```svelte
<script>
  import { formPersist } from "form-persist/svelte"
  const persist = formPersist({ key: "my-form", ttl: "24h" })
</script>

<form use:persist.action>...</form>
```

### Plain HTML / Vanilla JS

```html
<script type="module">
  import { FormPersist } from "form-persist"

  const form = new FormPersist({ key: "my-form", ttl: "24h" })
  form.attach(document.querySelector("#my-form"), {
    onRestore: (data) => console.log("Restored:", data),
    debounce: 500,
  })
</script>
```

---

## Storage Backends

| Backend | Key | Use case |
|---|---|---|
| `localStorage` (default) | `"localStorage"` | Web — survives page reload |
| `sessionStorage` | `"sessionStorage"` | Web — cleared when tab closes |
| `indexedDB` | `"indexedDB"` | Web — large data (no 5 MB limit) |
| `memory` | `"memory"` | SSR, Node.js, testing |
| Custom | any `StorageDriver` | Your own backend (DB, Redis, API) |

### Automatic fallback chain

When the primary storage is full (`QuotaExceededError`), `form-persist` automatically falls back to IndexedDB. You can also configure an explicit fallback:

```ts
new FormPersist({
  key: "large-form",
  storage: "localStorage",
  fallbackStorage: "indexedDB",
})
```

### Custom storage driver

```ts
class ApiStorageDriver {
  async get(key) { return (await fetch(`/api/state/${key}`)).text() }
  async set(key, value) { await fetch(`/api/state/${key}`, { method: "PUT", body: value }) }
  async delete(key) { await fetch(`/api/state/${key}`, { method: "DELETE" }) }
  async keys(prefix) { return [] }
  async clear(prefix) {}
}

new FormPersist({ key: "my-form", storage: new ApiStorageDriver() })
```

---

## Large Data Handling

Built-in LZ-string compression (no external dependency) reduces typical form JSON by 60–80 %. Enabled by default.

```ts
new FormPersist({
  key: "large-form",
  compress: true,      // default
  maxSize: "4MB",      // warn in console if payload exceeds this
  storage: "indexedDB" // switch to IndexedDB for unlimited storage
})
```

---

## TypeScript Types

```ts
import type {
  FormPersistConfig,
  PersistedForm,
  PersistedStep,
  StorageDriver,
  ClearReason,
  TTLString,
  FormInfo,
} from "form-persist"
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](LICENSE).
