# Contributing to form-persist

Thank you for taking the time to contribute!

## Development setup

```bash
git clone https://github.com/yourusername/form-persist
cd form-persist
npm install
```

## Commands

```bash
npm run build        # compile all six bundles via tsup
npm test             # run tests with coverage (must stay ≥90%)
npm run test:watch   # watch mode
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier over src/ and tests/
npm run docs         # TypeDoc → docs/
```

## Project layout

```
src/
  core/        — FormPersist, StepManager, Expiry, Compressor, Crypto
  storage/     — StorageDriver interface + five implementations
  adapters/    — React, React Native, Vue, Angular, Svelte wrappers
  utils/       — merge, sanitize, fingerprint helpers
tests/         — mirrors src/ layout; ≥90% coverage enforced
examples/      — illustrative usage (not executed by tests)
```

## Coding conventions

- **Zero runtime dependencies.** LZ compression and AES encryption are both inlined. Do not add `dependencies` to `package.json`.
- **All storage calls are async.** Even `localStorage` operations return `Promise` so the API is uniform across drivers.
- **SSR safety.** Check `typeof window !== "undefined"` before touching browser APIs; fall back to `MemoryDriver` on the server.
- **Framework adapters are optional peer deps.** A Vue user should never have React bundled.
- **No comments on obvious code.** Add a comment only when the *why* is non-obvious.

## Pull request checklist

- [ ] `npm test` passes with ≥90 % coverage
- [ ] `npm run build` succeeds — all six bundles in `dist/`
- [ ] `npm run lint` reports no errors
- [ ] New public API surface has JSDoc (`@param`, `@returns`, `@example`)
- [ ] `CHANGELOG.md` updated under `## [Unreleased]`

## Reporting bugs

Open an issue at <https://github.com/yourusername/form-persist/issues> with:

1. Minimal reproduction (CodeSandbox or a short code snippet)
2. Expected behaviour
3. Actual behaviour + browser / Node version
