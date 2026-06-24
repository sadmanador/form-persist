# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2024-01-01

### Added

- **Core engine** (`FormPersist`) — framework-agnostic class with debounced saves (300 ms default), storage fallback chain, version mismatch detection, and full event-listener lifecycle via `destroy()`.
- **Multi-step support** (`StepManager`) — `saveStep`, `completeStep`, `reset`; step completion timestamps and `currentStep` tracking.
- **TTL / expiry** (`Expiry`) — shorthand strings (`"30m"`, `"2h"`, `"24h"`, `"7d"`), automatic cleanup of all `form-persist:*` keys on every constructor call, and expiry checked on every `restore()`.
- **Compression** (`Compressor`) — inline LZ-string (base64, 6 bits/char), enabled by default; compressed payloads marked with a `\x00` prefix for safe round-trip detection.
- **Encryption** (`Crypto`) — AES-GCM 256-bit via Web Crypto API; 100 K PBKDF2 iterations; derived key cached per passphrase.
- **Storage drivers** — `LocalStorageDriver` (with 4 MB soft-warn and `QuotaExceededError` propagation), `SessionStorageDriver`, `IndexedDBDriver`, `MemoryDriver` (SSR / testing), `AsyncStorageDriver` (React Native adapter).
- **Framework adapters** — `useFormPersist` (React web), `useFormPersistNative` (React Native), `useFormPersist` (Vue 3 composable), `FormPersistService` (Angular injectable), `formPersist` (Svelte store + `use:` action).
- **Plain HTML helper** — `FormPersist.attach(formEl)` auto-wires `input`/`change`/`submit` listeners and restores saved values into form fields.
- **Global utilities** — `clearAllForms()`, `clearForms(keys[])`, `runCleanup()`.
- **`onClear` reason codes** — `"submit"` | `"manual"` | `"reset"` | `"expired"` | `"logout"` | `"version-mismatch"`.
- **SSR safety** — every driver that needs the DOM falls back to `MemoryDriver` when `typeof window === "undefined"`.
- **Build** — six independent entry bundles (CJS + ESM + `.d.ts`) via tsup; tree-shakeable; zero runtime dependencies.
- **Tests** — >90 % coverage on statements / branches / functions / lines across 290+ test cases.
