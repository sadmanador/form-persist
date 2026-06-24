# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # compile all bundles via tsup
npm test               # run all tests with coverage (must stay ≥90%)
npm run test:watch     # run tests in watch mode
npx jest tests/core/FormPersist.test.ts   # run a single test file
npm run lint           # eslint src
npm run lint:fix       # eslint with auto-fix
npm run format         # prettier over src and tests
```

## Architecture

`form-persist` is a zero-runtime-dependency TypeScript library that auto-saves form state to browser storage and restores it on return. All async storage calls use Promises even for synchronous backends (localStorage) to keep the API uniform.

### Core engine (`src/core/`)

- **`FormPersist.ts`** — the main class; all framework adapters thin-wrap this. Handles debounced saves (300ms default), fallback storage on `QuotaExceededError`, the `attach()` DOM helper, and event-listener lifecycle (`destroy()`).
- **`StepManager.ts`** — encapsulates multi-step form state inside a `PersistedForm`. `saveStep` records data without marking completion; `completeStep` sets `completedAt` and advances `currentStep`.
- **`Expiry.ts`** — TTL parsing (`"30m"`, `"2h"`, `"24h"`, `"7d"` → ms), expiry checks, and `runGlobalCleanup` which scans all `form-persist:*` keys and deletes expired ones. Called automatically on every `FormPersist` constructor.
- **`Compressor.ts`** — inline LZ-string compression (base64, 6 bits/char). Enabled by default; compressed data is prefixed with a null byte (`\x00`) marker so deserialisation can distinguish it from plain JSON. The literal/reference asymmetry in `enlargeIn` decrements is intentional — do not "fix" it.
- **`Crypto.ts`** — AES-GCM 256-bit via the Web Crypto API. Derives a key with 100K PBKDF2 iterations; the derived key is cached per passphrase to avoid re-deriving on every save.

### Storage drivers (`src/storage/`)

All implement `StorageDriver` (`get/set/delete/keys/clear`). `LocalStorageDriver` exposes `isQuotaError` which `FormPersist._writeForm` uses to trigger the IndexedDB fallback. On SSR (`typeof window === "undefined"`) every driver that needs the DOM falls back to `MemoryDriver`.

### Framework adapters (`src/adapters/`)

Each adapter wraps `FormPersist` in the idiom of its framework:
- **React** (`useFormPersist`) — creates `FormPersist` once via `useRef`, uses callback refs so `onRestore`/`onSave`/etc. can change without recreating the instance.
- **React Native** (`useFormPersistNative`) — same pattern but accepts an `AsyncStorage`-compatible object as `storage`; the library never imports `@react-native-async-storage/async-storage` directly.
- **Vue** — composable returning reactive refs.
- **Angular** — injectable service with `init()` / `destroy()`.
- **Svelte** — store + `use:persist.action` directive.

### Build output

`tsup.config.ts` produces six independent entry bundles in `dist/` (CJS + ESM + `.d.ts` each): `index`, `react`, `react-native`, `vue`, `angular`, `svelte`. Framework adapters are separate bundles so unused ones don't bloat the consumer's bundle. The package `exports` map routes sub-path imports (`form-persist/react`, etc.) to the right bundle.

### Storage key convention

All keys in storage are prefixed `form-persist:` — e.g. `form-persist:vaccine-arrival-report`. `clearAllForms` and `runCleanup` use this prefix to scope their scans.

### Clear reasons

`ClearReason` (`"submit" | "manual" | "reset" | "expired" | "logout" | "version-mismatch"`) is passed to the `onClear` callback. `reset()` fires `"reset"` and returns `currentStep` to 0; `clear("manual")` fires `"manual"` and leaves step position intact.

### Test coverage gate

`jest.config.ts` enforces 90% coverage on branches/functions/lines/statements. Angular and Svelte adapters are excluded from coverage collection (they require framework-specific environments).
