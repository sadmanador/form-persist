# form-persist — npm Library Planning Document (v1)

## Project Overview

**Package Name:** `form-persist`
**Goal:** A zero-dependency, framework-agnostic library that automatically saves form state as the user types and restores it on return — supporting single-page forms, multi-step wizard forms, and large data forms. Built with automatic expiry and secure clearing so saved data never lingers dangerously.
**Language:** TypeScript (compiled to JS, ships with `.d.ts` declarations)
**License:** MIT
**Install via:** npm, yarn, pnpm, bun — all supported

**Target Environments:**
| Environment | Support |
|-------------|---------|
| React (web) | ✅ |
| React Native | ✅ |
| Next.js (SSR + client) | ✅ |
| Vue 3 | ✅ |
| Angular | ✅ |
| Svelte / SvelteKit | ✅ |
| Remix | ✅ |
| Plain HTML/JS | ✅ |
| Node.js (testing) | ✅ |
| Deno | ✅ |
| Bun | ✅ |

---

## Real World Use Case — DGHS Vaccine Arrival Report Form

The DGHS vaccine arrival form at `evlmis.dghs.gov.bd` is a perfect example of what this library solves:

- The form has **multiple steps** — each step is revealed only after the previous one is confirmed
- The data per step can be **large** — batch numbers, quantities, dates, facility codes
- If the user accidentally closes the tab, navigates away, or the session times out mid-form — **all entered data is lost**
- The user has to **start from scratch** which is frustrating and wastes time

With `form-persist`:
- Each step's data is saved automatically as the user types
- If they leave and come back, they land back on the same step with all data intact
- After successful form submission, all saved data is **automatically cleared**
- Data expires after a configurable time (e.g. 24 hours) so it never sits in storage forever

---

## Core Concepts

### 1. Form Key
Every form gets a unique string key. This is how the library tells forms apart in storage.
```ts
formKey: "vaccine-arrival-report-dhaka-2024"
```

### 2. Storage Drivers
Where the data actually gets saved. Different environments need different storage:
- **Web:** `localStorage`, `sessionStorage`, `IndexedDB` (for large data)
- **React Native:** `AsyncStorage` (via adapter)
- **Custom:** bring your own storage (database, Redis, etc.)

### 3. Expiry
Every saved form has a timestamp. Data older than the configured TTL (time-to-live) is automatically deleted. Default: **24 hours**.

### 4. Steps
Multi-step forms track which step the user is on. Each step's data is saved independently so restoring brings them back to exactly where they left off.

### 5. Encryption (optional)
For sensitive forms (medical, financial), field values can be encrypted before being written to storage using the Web Crypto API — no external dependency.

### 6. Clear Triggers
Saved data is automatically cleared when:
- Form is successfully submitted
- TTL expires
- User explicitly calls `clear()`
- A configured session event fires (logout, tab close, etc.)

---

## Data Structure in Storage

```ts
// What gets saved under key "form-persist:vaccine-arrival-report"
interface PersistedForm {
  key: string;              // "vaccine-arrival-report"
  version: number;          // schema version — if form fields change, old data is discarded
  currentStep: number;      // which step the user was on (0-indexed)
  totalSteps: number;       // total number of steps
  steps: {
    [stepIndex: number]: {
      data: Record<string, any>;   // field name → value
      completedAt?: number;        // timestamp when step was confirmed
      valid: boolean;              // was this step valid when saved
    }
  };
  createdAt: number;        // unix timestamp — when first saved
  updatedAt: number;        // unix timestamp — last update
  expiresAt: number;        // unix timestamp — when to auto-delete
  checksum?: string;        // optional integrity check
  encrypted: boolean;       // whether values are encrypted
  metadata?: Record<string, any>; // app-specific metadata (userId, sessionId, etc.)
}
```

---

## Storage Size Handling

Large forms (like vaccine batch data with dozens of rows) can exceed `localStorage` limits (5MB).

The library handles this with an automatic storage fallback chain:

```
Try localStorage (5MB limit)
  → If data > 4MB, fall back to IndexedDB (unlimited)
  → If IndexedDB unavailable, compress with built-in LZ compression
  → If still too large, split across multiple storage keys automatically
  → In React Native, use AsyncStorage (adapter required)
```

Built-in **LZ string compression** (implemented inline, no external dep) reduces typical form JSON by 60–80%.

---

## Project File Structure

```
form-persist/
├── src/
│   ├── index.ts                  # main export barrel
│   ├── types.ts                  # all TS interfaces and types
│   ├── core/
│   │   ├── FormPersist.ts        # core class — framework-agnostic engine
│   │   ├── StepManager.ts        # multi-step form logic
│   │   ├── Expiry.ts             # TTL management and auto-cleanup
│   │   ├── Compressor.ts         # LZ string compression/decompression
│   │   └── Crypto.ts             # optional field encryption (Web Crypto API)
│   ├── storage/
│   │   ├── StorageDriver.ts      # abstract storage interface
│   │   ├── LocalStorageDriver.ts # web localStorage
│   │   ├── SessionStorageDriver.ts # web sessionStorage
│   │   ├── IndexedDBDriver.ts    # web IndexedDB (large data)
│   │   ├── MemoryDriver.ts       # in-memory (SSR, testing)
│   │   └── AsyncStorageDriver.ts # React Native adapter
│   ├── adapters/
│   │   ├── react/
│   │   │   ├── useFormPersist.ts       # React hook (web)
│   │   │   └── useFormPersistNative.ts # React Native hook
│   │   ├── vue/
│   │   │   └── useFormPersist.ts       # Vue 3 composable
│   │   ├── angular/
│   │   │   └── form-persist.service.ts # Angular service
│   │   └── svelte/
│   │       └── formPersist.ts          # Svelte store/action
│   └── utils/
│       ├── merge.ts              # deep merge saved data back into form
│       ├── sanitize.ts           # strip excluded fields before saving
│       └── fingerprint.ts        # generate stable form key from DOM (auto-key feature)
│
├── tests/
│   ├── core/
│   │   ├── FormPersist.test.ts
│   │   ├── StepManager.test.ts
│   │   ├── Expiry.test.ts
│   │   └── Compressor.test.ts
│   ├── storage/
│   │   ├── LocalStorageDriver.test.ts
│   │   ├── IndexedDBDriver.test.ts
│   │   └── MemoryDriver.test.ts
│   └── adapters/
│       ├── react.test.tsx
│       └── vue.test.ts
│
├── examples/
│   ├── react-single-step.tsx
│   ├── react-multistep.tsx
│   ├── react-native.tsx
│   ├── nextjs.tsx
│   ├── vue-multistep.vue
│   ├── angular-form.ts
│   ├── svelte-form.svelte
│   └── plain-html.html
│
├── dist/                         # compiled output (gitignored)
├── package.json
├── tsconfig.json
├── jest.config.ts
├── typedoc.json
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── .npmignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

---

## API Design — Complete Function Reference

---

### Core Class — `FormPersist`

The framework-agnostic engine. All framework adapters wrap this class.

```ts
import { FormPersist } from "form-persist"

const form = new FormPersist({
  // REQUIRED
  key: "vaccine-arrival-report",        // unique form identifier

  // STORAGE
  storage: "localStorage",              // "localStorage" | "sessionStorage" | "indexedDB" | "memory" | StorageDriver
  fallbackStorage: "indexedDB",         // fallback if primary storage is full

  // EXPIRY — REQUIRED (no forever storage)
  ttl: 24 * 60 * 60 * 1000,           // 24 hours in ms (default)
  // OR use shorthand:
  ttl: "24h",                          // "30m" | "2h" | "24h" | "7d"

  // MULTI-STEP
  steps: 5,                            // total number of steps (omit for single-step forms)

  // DATA SIZE
  compress: true,                      // auto-compress large data (default: true)
  maxSize: "4MB",                      // warn if saved data exceeds this

  // SECURITY
  encrypt: false,                      // encrypt values using Web Crypto API (default: false)
  encryptionKey: "your-secret",        // required if encrypt: true
  exclude: ["password", "cvv"],        // field names to NEVER save

  // VERSIONING
  version: 1,                          // bump this when form fields change — clears old saved data

  // CLEAR TRIGGERS
  clearOnSubmit: true,                 // auto-clear after successful submit (default: true)
  clearOnUnload: false,                // clear when tab/window closes (default: false)
  clearOnSessionEnd: false,            // clear on logout event (default: false)

  // CALLBACKS
  onRestore: (data) => {},             // called when saved data is restored
  onSave: (data) => {},                // called after each save
  onExpire: () => {},                  // called when data expires
  onClear: (reason) => {},             // called when data is cleared — reason: "submit"|"expired"|"manual"|"reset"|"logout"|"version-mismatch"
  onError: (error) => {},              // called on storage errors
})
```

---

### Core Methods

```ts
// Save current step data
form.save(stepIndex: number, data: Record<string, any>): Promise<void>

// Save all steps at once (single-step forms)
form.saveAll(data: Record<string, any>): Promise<void>

// Restore saved data — returns null if expired or not found
form.restore(): Promise<PersistedForm | null>

// Restore a specific step
form.restoreStep(stepIndex: number): Promise<Record<string, any> | null>

// Mark a step as completed and advance
form.completeStep(stepIndex: number, data: Record<string, any>): Promise<void>

// Get which step was last saved
form.getCurrentStep(): Promise<number>

// Check if saved data exists and is not expired
form.hasData(): Promise<boolean>

// Clear all saved data (with reason for logging)
form.clear(reason?: "submit" | "manual" | "logout"): Promise<void>

// Clear a specific step only
form.clearStep(stepIndex: number): Promise<void>

// Reset and start from step 0
form.reset(): Promise<void>

// Get time remaining before expiry (ms)
form.timeRemaining(): Promise<number | null>

// Get metadata about saved state
form.getInfo(): Promise<{
  exists: boolean;
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  createdAt: Date | null;
  expiresAt: Date | null;
  sizeBytes: number;
  compressed: boolean;
  encrypted: boolean;
} | null>

// Force extend the expiry time
form.extendTTL(additionalMs: number): Promise<void>

// Destroy instance and remove all listeners
form.destroy(): void
```

---

### React Hook — `useFormPersist` (web)

```ts
import { useFormPersist } from "form-persist/react"

function VaccineArrivalForm() {
  const {
    save,           // save current data
    restore,        // get saved data
    clear,          // clear saved data
    currentStep,    // which step is active
    setStep,        // change active step
    completeStep,   // mark step done and go next
    hasData,        // boolean — saved data exists
    isRestored,     // boolean — data has been restored into form
    timeRemaining,  // ms until expiry
    info,           // full metadata object
  } = useFormPersist({
    key: "vaccine-arrival-report",
    steps: 4,
    ttl: "24h",
    exclude: ["password"],
    clearOnSubmit: true,
    onRestore: (data) => {
      // pre-fill your form fields here
      console.log("Restored from step:", data.currentStep)
    },
    onExpire: () => {
      alert("Your saved form data has expired. Please start again.")
    }
  })

  // Auto-save on field change
  const handleChange = (e) => {
    save(currentStep, { ...formData, [e.target.name]: e.target.value })
  }

  // Mark step complete and reveal next step
  const handleStepConfirm = async (stepData) => {
    await completeStep(currentStep, stepData)
    // next step is now unlocked — currentStep auto-increments
  }

  const handleSubmit = async () => {
    await submitToServer(formData)
    await clear("submit")  // clears all saved data after successful submit
  }

  return (
    <div>
      {hasData && !isRestored && (
        <Banner>
          You have unsaved progress from earlier.
          <button onClick={restore}>Continue where you left off</button>
          <button onClick={clear}>Start fresh</button>
        </Banner>
      )}
      {timeRemaining && timeRemaining < 3600000 && (
        <Warning>Your saved data expires in less than 1 hour.</Warning>
      )}
      {/* form steps */}
    </div>
  )
}
```

---

### React Hook — `useFormPersistNative` (React Native)

```ts
import { useFormPersistNative } from "form-persist/react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

function VaccineFormNative() {
  const { save, restore, clear, currentStep, completeStep, hasData } =
    useFormPersistNative({
      key: "vaccine-arrival-mobile",
      steps: 4,
      ttl: "48h",                   // longer TTL for mobile (user might switch apps)
      storage: AsyncStorage,        // pass AsyncStorage as the driver
      clearOnSubmit: true,
      onRestore: (data) => {
        // pre-fill React Native form fields
      }
    })

  return (
    // React Native form JSX
  )
}
```

---

### Vue 3 Composable — `useFormPersist`

```ts
import { useFormPersist } from "form-persist/vue"

export default {
  setup() {
    const { save, restore, clear, currentStep, completeStep, hasData, timeRemaining } =
      useFormPersist({
        key: "vaccine-arrival-vue",
        steps: 4,
        ttl: "24h",
        clearOnSubmit: true,
        onRestore(data) {
          // pre-fill form refs
        }
      })

    return { save, restore, clear, currentStep, completeStep, hasData }
  }
}
```

---

### Angular Service — `FormPersistService`

```ts
import { FormPersistService } from "form-persist/angular"
import { Component, OnInit, OnDestroy } from "@angular/core"

@Component({ selector: "app-vaccine-form", templateUrl: "./vaccine-form.component.html" })
export class VaccineFormComponent implements OnInit, OnDestroy {
  constructor(private formPersist: FormPersistService) {}

  async ngOnInit() {
    await this.formPersist.init({
      key: "vaccine-arrival-angular",
      steps: 4,
      ttl: "24h",
      clearOnSubmit: true,
    })
    const saved = await this.formPersist.restore()
    if (saved) {
      // pre-fill Angular form controls
    }
  }

  async onStepConfirm(stepData: any) {
    await this.formPersist.completeStep(this.formPersist.currentStep, stepData)
  }

  async onSubmit() {
    await this.submitToServer()
    await this.formPersist.clear("submit")
  }

  ngOnDestroy() {
    this.formPersist.destroy()
  }
}
```

---

### Svelte Action — `formPersist`

```svelte
<script>
  import { formPersist } from "form-persist/svelte"

  let currentStep = 0
  let formData = {}

  const persist = formPersist({
    key: "vaccine-arrival-svelte",
    steps: 4,
    ttl: "24h",
    clearOnSubmit: true,
    onRestore: (data) => {
      formData = data.steps[data.currentStep]?.data ?? {}
      currentStep = data.currentStep
    }
  })
</script>

<form use:persist.action>
  <!-- form fields -->
</form>
```

---

### Plain HTML / Vanilla JS

```html
<script type="module">
  import { FormPersist } from "https://cdn.jsdelivr.net/npm/form-persist/dist/index.esm.js"

  const form = new FormPersist({
    key: "vaccine-arrival-plain",
    steps: 4,
    ttl: "24h",
    clearOnSubmit: true,
  })

  // Auto-attach to all inputs in a form element
  form.attach(document.querySelector("#vaccine-form"), {
    onRestore: (data) => console.log("Restored:", data),
    debounce: 500,  // save 500ms after user stops typing
  })
</script>
```

---

### Next.js (SSR Safe)

```tsx
// form-persist detects SSR automatically and uses MemoryDriver on server
// No "window is not defined" errors
import { useFormPersist } from "form-persist/react"

export default function VaccinePage() {
  const { save, restore, currentStep, completeStep, hasData, clear } =
    useFormPersist({
      key: "vaccine-arrival-next",
      steps: 4,
      ttl: "24h",
      storage: "localStorage",    // safely ignored on server, used on client
      clearOnSubmit: true,
    })

  return <form>...</form>
}
```

---

## Expiry & Security System (Critical Design)

### Why Data Must Not Live Forever

Persisted form data can contain sensitive information — patient names, vaccine batch codes, facility IDs, personal health data. Keeping it in localStorage indefinitely is a security risk if:
- The user is on a shared/public computer
- The browser is compromised
- The session has ended but storage was never cleared

### Expiry Enforcement

Every saved form has an `expiresAt` timestamp. The library checks expiry:
1. **On restore** — if expired, data is deleted immediately and `null` is returned
2. **On page load** — a background cleanup runs and deletes all expired `form-persist:*` keys
3. **On visibility change** — when the tab becomes visible again after being hidden

```ts
// Expiry options
ttl: "30m"   // 30 minutes  — for short public-terminal sessions
ttl: "2h"    // 2 hours     — for a typical work session
ttl: "24h"   // 24 hours    — default, survives overnight (default)
ttl: "7d"    // 7 days      — for long multi-day form filling
ttl: 0       // sessionStorage mode — cleared when tab closes
```

### Clear Triggers — Full List

```ts
// 1. Manual clear (most common — after successful submit)
await form.clear("submit")

// 2. Auto-clear on submit (if clearOnSubmit: true)
// Triggered automatically when form.submit() is called

// 3. TTL expiry — auto-detected on next restore() call

// 4. Version mismatch — if form fields changed since last save
// Set version: 2 in config → all v1 saves are automatically discarded

// 5. Session end (optional)
// clearOnSessionEnd: true → listens for a custom "session-end" event
document.dispatchEvent(new Event("session-end"))

// 6. Tab/window close (optional, use carefully)
// clearOnUnload: true → clears on beforeunload
// WARNING: not reliable on mobile browsers — use sessionStorage instead

// 7. Manual logout integration
import { clearAllForms } from "form-persist"
await clearAllForms()  // nukes ALL form-persist:* keys from storage — call on logout

// 8. Global TTL cleanup (runs automatically on library init)
import { runCleanup } from "form-persist"
await runCleanup()  // scans storage and removes all expired form-persist:* entries
```

### User-Initiated Clear (Button Pattern)

This is a first-class use case — the developer puts a **"Start Fresh" / "Clear My Data"** button in the UI and the user decides to wipe their saved progress themselves.

The library provides everything needed to build this pattern cleanly across all frameworks.

#### Functions for user-initiated clearing

```ts
// Clear saved data for ONE specific form
await form.clear("manual")

// Clear saved data for a LIST of specific forms
import { clearForms } from "form-persist"
await clearForms(["vaccine-arrival-report", "patient-registration"])

// Clear ALL saved form data across the entire app
import { clearAllForms } from "form-persist"
await clearAllForms()

// Clear + reset to step 0 (user wants to start the form over from scratch)
await form.reset()
```

#### React — "Start Fresh" button

```tsx
import { useFormPersist } from "form-persist/react"

function VaccineForm() {
  const { save, restore, clear, reset, hasData, currentStep, info } =
    useFormPersist({ key: "vaccine-arrival-report", steps: 4, ttl: "24h" })

  // Show the button only when there is actually saved data to clear
  return (
    <div>
      {hasData && (
        <div className="restore-banner">
          <p>You have saved progress from a previous session (Step {currentStep + 1} of 4).</p>
          <button onClick={restore}>Continue where I left off</button>
          <button onClick={() => reset()}>Start fresh — clear my saved data</button>
        </div>
      )}

      {/* Optional: always-visible clear button while filling the form */}
      <button
        onClick={async () => {
          const confirmed = window.confirm("This will clear all your saved progress. Are you sure?")
          if (confirmed) {
            await reset()
            // optionally redirect or reset your local form state here
          }
        }}
      >
        🗑 Clear saved data
      </button>
    </div>
  )
}
```

#### React Native — "Start Fresh" button

```tsx
import { useFormPersistNative } from "form-persist/react-native"
import { Alert, Button } from "react-native"

function VaccineFormNative() {
  const { reset, hasData, currentStep } = useFormPersistNative({
    key: "vaccine-arrival-mobile",
    steps: 4,
    ttl: "48h",
    storage: AsyncStorage,
  })

  const handleClearPress = () => {
    Alert.alert(
      "Clear Saved Data",
      "This will erase your saved form progress. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, clear it",
          style: "destructive",
          onPress: async () => {
            await reset()
            // reset your local RN state here
          },
        },
      ]
    )
  }

  return (
    <>
      {hasData && (
        <Button title={`Clear saved data (Step ${currentStep + 1})`} onPress={handleClearPress} />
      )}
    </>
  )
}
```

#### Vue 3 — "Start Fresh" button

```vue
<template>
  <div v-if="hasData" class="restore-banner">
    <p>You have saved progress. Resume from Step {{ currentStep + 1 }}?</p>
    <button @click="restore">Continue</button>
    <button @click="handleClear">Start fresh</button>
  </div>
</template>

<script setup lang="ts">
import { useFormPersist } from "form-persist/vue"

const { restore, reset, hasData, currentStep } = useFormPersist({
  key: "vaccine-arrival-vue",
  steps: 4,
  ttl: "24h",
})

async function handleClear() {
  if (confirm("Clear all saved progress?")) {
    await reset()
  }
}
</script>
```

#### Plain HTML — "Start Fresh" button

```html
<button id="clear-btn" style="display:none">🗑 Clear my saved data</button>

<script type="module">
  import { FormPersist } from "form-persist"

  const form = new FormPersist({ key: "vaccine-form", steps: 4, ttl: "24h" })
  const clearBtn = document.getElementById("clear-btn")

  // Show button only if there's data to clear
  const hasData = await form.hasData()
  if (hasData) clearBtn.style.display = "block"

  clearBtn.addEventListener("click", async () => {
    if (confirm("This will clear your saved form progress. Continue?")) {
      await form.reset()
      clearBtn.style.display = "none"
      // optionally reload or reset form fields
    }
  })
</script>
```

#### What each clear function does — summary table

| Function | Clears | Use case |
|----------|--------|----------|
| `form.clear("manual")` | This form only — keeps current step position | User wants to wipe data but stay on the form |
| `form.reset()` | This form only — resets to step 0 | User wants to start the whole form over |
| `form.clearStep(stepIndex)` | One specific step only | User wants to redo a single step |
| `clearForms(["key1","key2"])` | Named forms only | Clear a set of related forms together |
| `clearAllForms()` | Every form-persist entry in storage | Logout button — nuke everything |

#### `onClear` callback — let the developer react to clearing

```ts
useFormPersist({
  key: "vaccine-arrival-report",
  steps: 4,
  ttl: "24h",
  onClear: (reason) => {
    // reason: "submit" | "manual" | "reset" | "expired" | "logout" | "version-mismatch"
    if (reason === "manual" || reason === "reset") {
      // user chose to clear — log it, show a toast, reset local state
      showToast("Your saved data has been cleared.")
      setFormData({})
      setCurrentStep(0)
    }
    if (reason === "expired") {
      showToast("Your saved session expired. Please fill the form again.")
    }
  }
})
```

---

### Sensitive Field Exclusion

```ts
// Always exclude sensitive fields — they are NEVER written to storage
exclude: ["password", "confirmPassword", "cvv", "pin", "otp", "ssn"]

// Fields in this list are stripped before save and never restored
// The library logs a warning if an excluded field is accidentally passed to save()
```

### Optional Encryption

```ts
// For medical/financial forms — encrypt all values before storage
encrypt: true,
encryptionKey: process.env.FORM_ENCRYPT_KEY,  // min 16 chars

// Uses Web Crypto API (built-in browser API — no external dep)
// AES-GCM 256-bit encryption
// Key is never stored — data is unreadable without the key
// If key changes, old encrypted data is automatically discarded
```

---

## Storage Driver Interface (Custom Storage)

```ts
// Implement this interface to use any storage backend
interface StorageDriver {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  keys(prefix: string): Promise<string[]>
  clear(prefix: string): Promise<void>
}

// Example: use your own backend API as storage
class ApiStorageDriver implements StorageDriver {
  async get(key: string) {
    const res = await fetch(`/api/form-state/${key}`)
    return res.ok ? await res.text() : null
  }
  async set(key: string, value: string) {
    await fetch(`/api/form-state/${key}`, { method: "PUT", body: value })
  }
  async delete(key: string) {
    await fetch(`/api/form-state/${key}`, { method: "DELETE" })
  }
  async keys(prefix: string) { return [] }
  async clear(prefix: string) {}
}

// Use it
const form = new FormPersist({
  key: "vaccine-form",
  storage: new ApiStorageDriver(),  // pass custom driver
  ttl: "24h",
})
```

---

## Complete Export List (`src/index.ts`)

```ts
// Core
export { FormPersist }
export { clearAllForms, clearForms, runCleanup }

// Storage Drivers
export {
  LocalStorageDriver,
  SessionStorageDriver,
  IndexedDBDriver,
  MemoryDriver,
  AsyncStorageDriver,
}

// Types
export type {
  FormPersistConfig,
  PersistedForm,
  PersistedStep,
  StorageDriver,
  ClearReason,        // "submit" | "manual" | "reset" | "expired" | "logout" | "version-mismatch"
  TTLString,
  FormInfo,
}

// Sub-path exports (framework adapters)
// "form-persist/react"        → useFormPersist
// "form-persist/react-native" → useFormPersistNative
// "form-persist/vue"          → useFormPersist
// "form-persist/angular"      → FormPersistService, FormPersistModule
// "form-persist/svelte"       → formPersist action
```

---

## package.json

```json
{
  "name": "form-persist",
  "version": "0.1.0",
  "description": "Framework-agnostic form state persistence with multi-step support, auto-expiry, encryption, and large data handling. Works with React, React Native, Vue, Angular, Svelte, Next.js and plain HTML.",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import":  "./dist/index.esm.js",
      "require": "./dist/index.js",
      "types":   "./dist/index.d.ts"
    },
    "./react": {
      "import":  "./dist/react.esm.js",
      "require": "./dist/react.js",
      "types":   "./dist/react.d.ts"
    },
    "./react-native": {
      "import":  "./dist/react-native.esm.js",
      "require": "./dist/react-native.js",
      "types":   "./dist/react-native.d.ts"
    },
    "./vue": {
      "import":  "./dist/vue.esm.js",
      "require": "./dist/vue.js",
      "types":   "./dist/vue.d.ts"
    },
    "./angular": {
      "import":  "./dist/angular.esm.js",
      "require": "./dist/angular.js",
      "types":   "./dist/angular.d.ts"
    },
    "./svelte": {
      "import":  "./dist/svelte.esm.js",
      "require": "./dist/svelte.js",
      "types":   "./dist/svelte.d.ts"
    }
  },
  "files": ["dist", "README.md", "LICENSE", "CHANGELOG.md"],
  "sideEffects": false,
  "scripts": {
    "build":          "tsup --config tsup.config.ts",
    "test":           "jest --coverage",
    "test:watch":     "jest --watch",
    "lint":           "eslint src/**/*.ts",
    "lint:fix":       "eslint src/**/*.ts --fix",
    "format":         "prettier --write src/**/*.ts tests/**/*.ts",
    "docs":           "typedoc src/index.ts --out docs",
    "prepublishOnly": "npm run build && npm test"
  },
  "keywords": [
    "form", "persist", "form-persist", "auto-save", "form-state",
    "multi-step", "wizard", "form-recovery", "localStorage",
    "react", "react-native", "vue", "angular", "svelte", "nextjs",
    "form-storage", "draft", "resume-form", "form-expiry"
  ],
  "author": "Your Name <your@email.com>",
  "license": "MIT",
  "repository": { "type": "git", "url": "https://github.com/yourusername/form-persist" },
  "homepage": "https://github.com/yourusername/form-persist#readme",
  "bugs":     { "url": "https://github.com/yourusername/form-persist/issues" },
  "engines":  { "node": ">=14.0.0" },
  "peerDependencies": {
    "react":                              ">=17.0.0",
    "react-native":                       ">=0.68.0",
    "@react-native-async-storage/async-storage": ">=1.0.0",
    "vue":                                ">=3.0.0",
    "@angular/core":                      ">=14.0.0",
    "svelte":                             ">=3.0.0"
  },
  "peerDependenciesMeta": {
    "react":                              { "optional": true },
    "react-native":                       { "optional": true },
    "@react-native-async-storage/async-storage": { "optional": true },
    "vue":                                { "optional": true },
    "@angular/core":                      { "optional": true },
    "svelte":                             { "optional": true }
  },
  "devDependencies": {
    "typescript":                         "^5.0.0",
    "tsup":                               "^8.0.0",
    "ts-node":                            "^10.0.0",
    "jest":                               "^29.0.0",
    "ts-jest":                            "^29.0.0",
    "@types/jest":                        "^29.0.0",
    "@types/node":                        "^20.0.0",
    "@testing-library/react":            "^14.0.0",
    "eslint":                             "^8.0.0",
    "@typescript-eslint/parser":          "^6.0.0",
    "@typescript-eslint/eslint-plugin":   "^6.0.0",
    "prettier":                           "^3.0.0",
    "typedoc":                            "^0.25.0"
  }
}
```

---

## tsup.config.ts (Multi-Entry Build)

```ts
import { defineConfig } from "tsup"

export default defineConfig([
  // Core bundle
  { entry: { index: "src/index.ts" }, format: ["cjs", "esm"], dts: true, treeshake: true },
  // Framework adapters — built separately so unused ones don't bloat the bundle
  { entry: { react:         "src/adapters/react/useFormPersist.ts"       }, format: ["cjs", "esm"], dts: true },
  { entry: { "react-native":"src/adapters/react/useFormPersistNative.ts" }, format: ["cjs", "esm"], dts: true },
  { entry: { vue:           "src/adapters/vue/useFormPersist.ts"         }, format: ["cjs", "esm"], dts: true },
  { entry: { angular:       "src/adapters/angular/form-persist.service.ts"},format: ["cjs", "esm"], dts: true },
  { entry: { svelte:        "src/adapters/svelte/formPersist.ts"         }, format: ["cjs", "esm"], dts: true },
])
```

---

## Implementation Order (for Claude Code)

### Phase 1 — Project Setup
- [ ] `npm init -y`
- [ ] Install devDependencies
- [ ] Create `tsconfig.json`, `tsup.config.ts`, `jest.config.ts`
- [ ] Create `.eslintrc.json`, `.prettierrc`, `.gitignore`, `.npmignore`
- [ ] Create full folder structure

### Phase 2 — Core Engine
- [ ] `src/types.ts` — all interfaces with JSDoc
- [ ] `src/core/Expiry.ts` — TTL parsing, expiry check, background cleanup
- [ ] `src/core/Compressor.ts` — LZ string compression/decompression (inline, no dep)
- [ ] `src/core/Crypto.ts` — AES-GCM encryption using Web Crypto API
- [ ] `src/core/StepManager.ts` — multi-step tracking, completeStep, getCurrentStep
- [ ] `src/core/FormPersist.ts` — main class wiring everything together

### Phase 3 — Storage Drivers
- [ ] `src/storage/StorageDriver.ts` — abstract interface
- [ ] `src/storage/MemoryDriver.ts` — in-memory (SSR + tests)
- [ ] `src/storage/LocalStorageDriver.ts` — with size check and IndexedDB fallback
- [ ] `src/storage/SessionStorageDriver.ts`
- [ ] `src/storage/IndexedDBDriver.ts` — for large data
- [ ] `src/storage/AsyncStorageDriver.ts` — React Native adapter

### Phase 4 — Framework Adapters
- [ ] `src/adapters/react/useFormPersist.ts` — React web hook
- [ ] `src/adapters/react/useFormPersistNative.ts` — React Native hook
- [ ] `src/adapters/vue/useFormPersist.ts` — Vue 3 composable
- [ ] `src/adapters/angular/form-persist.service.ts` — Angular injectable service
- [ ] `src/adapters/svelte/formPersist.ts` — Svelte store + action
- [ ] `src/utils/fingerprint.ts` — auto-key from DOM (for plain HTML `form.attach()`)
- [ ] `src/index.ts` — export barrel + `clearAllForms`, `runCleanup`

### Phase 5 — Tests
- [ ] `tests/core/Expiry.test.ts`
- [ ] `tests/core/Compressor.test.ts`
- [ ] `tests/core/StepManager.test.ts`
- [ ] `tests/core/FormPersist.test.ts`
- [ ] `tests/storage/LocalStorageDriver.test.ts`
- [ ] `tests/storage/IndexedDBDriver.test.ts`
- [ ] `tests/storage/MemoryDriver.test.ts`
- [ ] `tests/adapters/react.test.tsx`
- [ ] `tests/adapters/vue.test.ts`
- [ ] Edge cases: expired data, corrupted data, storage full, SSR, version mismatch
- [ ] Target: >90% coverage

### Phase 6 — Examples
- [ ] `examples/react-single-step.tsx`
- [ ] `examples/react-multistep.tsx`
- [ ] `examples/react-native.tsx`
- [ ] `examples/nextjs.tsx`
- [ ] `examples/vue-multistep.vue`
- [ ] `examples/angular-form.ts`
- [ ] `examples/svelte-form.svelte`
- [ ] `examples/plain-html.html`

### Phase 7 — Docs & Publish-Ready Polish
- [ ] JSDoc on every export (`@param`, `@returns`, `@example`)
- [ ] Write complete `README.md` (sections below)
- [ ] Write `CHANGELOG.md` with v0.1.0 entry
- [ ] Write `CONTRIBUTING.md`
- [ ] Run `npm run docs` → verify TypeDoc output
- [ ] Run `npm run build` → verify all adapter bundles in `dist/`
- [ ] Run `npm pack --dry-run` → only `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md`
- [ ] `npm test` → all pass, >90% coverage

### Phase 8 — Publish
- [ ] `npm login`
- [ ] `npm publish --access public`
- [ ] GitHub release `v0.1.0`

---

## README.md — Required Sections

```
# form-persist

> Auto-save form state. Restore on return. Never lose a user's work again.
> Multi-step forms, large data, expiry, encryption. React, Vue, Angular, Svelte, React Native.

[badges: npm, downloads, license, TypeScript, coverage, bundle size]

## The Problem
## Installation (npm / yarn / pnpm / bun)
## Quick Start
## Multi-Step Forms (step-by-step guide)
## Data Expiry & Security (most important section)
  - TTL options
  - Clear triggers (submit, logout, unload, manual)
  - Excluding sensitive fields
  - Encryption
  - clearAllForms() on logout
## API Reference (FormPersist class — all options and methods)
## Framework Guides
  - React
  - React Native
  - Next.js (SSR safe)
  - Vue 3
  - Angular
  - Svelte / SvelteKit
  - Plain HTML
## Storage Backends
  - localStorage (default)
  - sessionStorage
  - IndexedDB (large data)
  - Custom driver
## Large Data Handling
## TypeScript Types
## Contributing
## License
```

---

## Notes for Claude Code

- **Zero runtime dependencies** — LZ compression and AES encryption are both implemented inline
- **SSR safe** — always check `typeof window !== "undefined"` before touching browser APIs; fall back to `MemoryDriver` on server
- **React Native** requires `@react-native-async-storage/async-storage` as a peer dep — the user passes it in as the storage driver, the library never imports it directly
- **All framework adapters are optional peer deps** — a Vue user should not have React bundled
- **`clearAllForms()`** must scan storage for all keys starting with `form-persist:` and delete them — useful for logout handlers
- **`clearForms(["key1","key2"])`** clears only the listed form keys — useful when multiple related forms need clearing together
- **`form.reset()`** clears data AND resets `currentStep` to 0 — fires `onClear` with reason `"reset"`
- **`form.clear("manual")`** clears data but does NOT reset step — fires `onClear` with reason `"manual"`
- **`onClear` callback** must always fire with the correct reason so developers can update their local UI state (reset form fields, show toast, redirect)
- **`runCleanup()`** must scan all `form-persist:*` keys and delete any where `expiresAt` is in the past — call this on app init
- **Version mismatch** — if saved data has `version: 1` and config says `version: 2`, immediately delete the saved data and return null
- **`exclude` fields** — strip these from data BEFORE writing to storage, never after
- **Debounce saves** — core class should debounce `save()` calls by 300ms by default to avoid hammering storage on every keystroke
- **`form.attach(formElement)`** for plain HTML — add `input`, `change`, `select` event listeners automatically
- **Storage fallback chain** — try localStorage → if QuotaExceededError, try IndexedDB → if unavailable, try compressed localStorage → log warning if all fail
- **All storage operations are async** (`Promise`-based) even for localStorage — keeps the API consistent across all drivers including IndexedDB and AsyncStorage
- **`npm pack --dry-run`** must show only `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md` — no source, no tests, no examples
