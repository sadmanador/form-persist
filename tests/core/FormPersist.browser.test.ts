/**
 * @jest-environment jsdom
 */
import { FormPersist } from "../../src/core/FormPersist"
import { MemoryDriver } from "../../src/storage/MemoryDriver"
import type { FormPersistConfig } from "../../src/types"

function makeConfig(overrides: Partial<FormPersistConfig> = {}): FormPersistConfig {
  return {
    key: "browser-test-form",
    ttl: "24h",
    storage: new MemoryDriver(),
    ...overrides,
  }
}

// ── _createDriver with named storage types ────────────────────────────────────

describe("_createDriver — named storage types in browser env", () => {
  it("creates a sessionStorage-backed instance without throwing", async () => {
    const fp = new FormPersist(makeConfig({ storage: "sessionStorage" }))
    await fp.saveAll({ x: 1 })
    const form = await fp.restore()
    expect(form!.steps[0].data).toEqual({ x: 1 })
    fp.destroy()
    sessionStorage.clear()
  })

  it("creates a localStorage-backed instance without throwing", async () => {
    const fp = new FormPersist(makeConfig({ storage: "localStorage" }))
    await fp.saveAll({ x: 1 })
    const form = await fp.restore()
    expect(form!.steps[0].data).toEqual({ x: 1 })
    fp.destroy()
    localStorage.clear()
  })

  it("creates a memory-backed instance without throwing", async () => {
    const fp = new FormPersist(makeConfig({ storage: "memory" }))
    await fp.saveAll({ x: 1 })
    const form = await fp.restore()
    expect(form!.steps[0].data).toEqual({ x: 1 })
    fp.destroy()
  })

  it("creates an indexedDB-backed instance without throwing", async () => {
    const fp = new FormPersist(makeConfig({ storage: "indexedDB" }))
    fp.destroy()
  })

  it("throws for unknown storage type", () => {
    expect(
      () => new FormPersist(makeConfig({ storage: "unknown" as never }))
    ).toThrow(/Unknown storage type/)
  })
})

// ── parseSizeBytes via maxSize ────────────────────────────────────────────────

describe("maxSize warning", () => {
  it("logs a warning when serialized data exceeds maxSize", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
    // Bare number = bytes; "1" means 1 byte, so any real save will exceed it
    const fp = new FormPersist(makeConfig({ maxSize: "1", compress: false }))
    await fp.saveAll({ data: "hello" })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("maxSize"))
    warn.mockRestore()
    fp.destroy()
  })

  it("accepts KB maxSize without warning for small data", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
    const fp = new FormPersist(makeConfig({ maxSize: "100KB", compress: false }))
    await fp.saveAll({ x: 1 })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
    fp.destroy()
  })

  it("accepts MB maxSize", async () => {
    const fp = new FormPersist(makeConfig({ maxSize: "4MB" }))
    await fp.saveAll({ x: 1 })
    const form = await fp.restore()
    expect(form).not.toBeNull()
    fp.destroy()
  })
})

// ── clearOnUnload ─────────────────────────────────────────────────────────────

describe("clearOnUnload", () => {
  it("clears data when beforeunload fires", async () => {
    const onClear = jest.fn()
    const fp = new FormPersist(makeConfig({ clearOnUnload: true, onClear }))
    await fp.saveAll({ x: 1 })

    window.dispatchEvent(new Event("beforeunload"))

    // Allow microtasks to settle
    await new Promise((r) => setTimeout(r, 10))

    expect(onClear).toHaveBeenCalledWith("manual")
    fp.destroy()
  })
})

// ── clearOnSessionEnd ─────────────────────────────────────────────────────────

describe("clearOnSessionEnd", () => {
  it("clears data when session-end event fires", async () => {
    const onClear = jest.fn()
    const fp = new FormPersist(makeConfig({ clearOnSessionEnd: true, onClear }))
    await fp.saveAll({ x: 1 })

    document.dispatchEvent(new Event("session-end"))

    await new Promise((r) => setTimeout(r, 10))

    expect(onClear).toHaveBeenCalledWith("logout")
    fp.destroy()
  })
})

// ── destroy removes event listeners ──────────────────────────────────────────

describe("destroy — removes event listeners", () => {
  it("does not clear after destroy even if beforeunload fires", async () => {
    const onClear = jest.fn()
    const fp = new FormPersist(makeConfig({ clearOnUnload: true, onClear }))
    await fp.saveAll({ x: 1 })
    fp.destroy()

    window.dispatchEvent(new Event("beforeunload"))
    await new Promise((r) => setTimeout(r, 10))

    expect(onClear).not.toHaveBeenCalled()
  })

  it("does not clear after destroy even if session-end fires", async () => {
    const onClear = jest.fn()
    const fp = new FormPersist(makeConfig({ clearOnSessionEnd: true, onClear }))
    await fp.saveAll({ x: 1 })
    fp.destroy()

    document.dispatchEvent(new Event("session-end"))
    await new Promise((r) => setTimeout(r, 10))

    expect(onClear).not.toHaveBeenCalled()
  })
})

// ── attach ───────────────────────────────────────────────────────────────────

describe("attach", () => {
  function makeForm(fields: Record<string, string> = {}): HTMLFormElement {
    const form = document.createElement("form")
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement("input")
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    document.body.appendChild(form)
    return form
  }

  afterEach(() => {
    document.body.innerHTML = ""
    localStorage.clear()
  })

  it("returns a detach function", () => {
    const fp = new FormPersist(makeConfig())
    const form = makeForm()
    const detach = fp.attach(form)
    expect(typeof detach).toBe("function")
    detach()
    fp.destroy()
  })

  it("restores saved data into form fields", async () => {
    const driver = new MemoryDriver()
    const seed = new FormPersist(makeConfig({ storage: driver }))
    await seed.saveAll({ username: "alice" })
    seed.destroy()

    const form = makeForm({ username: "" })
    const fp = new FormPersist(makeConfig({ storage: driver }))
    fp.attach(form)

    await new Promise((r) => setTimeout(r, 50))
    expect((form.elements.namedItem("username") as HTMLInputElement).value).toBe("alice")
    fp.destroy()
  })

  it("saves data on input event", async () => {
    const form = makeForm({ name: "" })
    const fp = new FormPersist(makeConfig({ debounce: 0 }))
    fp.attach(form)

    const input = form.elements.namedItem("name") as HTMLInputElement
    input.value = "Bob"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    await new Promise((r) => setTimeout(r, 50))
    const saved = await fp.restore()
    expect(saved!.steps[0].data["name"]).toBe("Bob")
    fp.destroy()
  })

  it("saves data on change event", async () => {
    const form = makeForm({ city: "" })
    const fp = new FormPersist(makeConfig({ debounce: 0 }))
    fp.attach(form)

    const input = form.elements.namedItem("city") as HTMLInputElement
    input.value = "Dhaka"
    input.dispatchEvent(new Event("change", { bubbles: true }))

    await new Promise((r) => setTimeout(r, 50))
    const saved = await fp.restore()
    expect(saved!.steps[0].data["city"]).toBe("Dhaka")
    fp.destroy()
  })

  it("clears data on submit when clearOnSubmit is true (default)", async () => {
    const onClear = jest.fn()
    const form = makeForm({ x: "1" })
    const fp = new FormPersist(makeConfig({ onClear }))
    fp.attach(form)

    await fp.saveAll({ x: "1" })
    form.dispatchEvent(new Event("submit"))

    await new Promise((r) => setTimeout(r, 50))
    expect(onClear).toHaveBeenCalledWith("submit")
    fp.destroy()
  })

  it("does not clear on submit when clearOnSubmit is false", async () => {
    const onClear = jest.fn()
    const form = makeForm({ x: "1" })
    const fp = new FormPersist(makeConfig({ clearOnSubmit: false, onClear }))
    fp.attach(form)

    await fp.saveAll({ x: "1" })
    form.dispatchEvent(new Event("submit"))

    await new Promise((r) => setTimeout(r, 50))
    expect(onClear).not.toHaveBeenCalled()
    fp.destroy()
  })

  it("detach removes all listeners", async () => {
    const form = makeForm({ x: "" })
    const fp = new FormPersist(makeConfig({ debounce: 0 }))
    const detach = fp.attach(form)
    detach()

    const input = form.elements.namedItem("x") as HTMLInputElement
    input.value = "after-detach"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    await new Promise((r) => setTimeout(r, 50))
    expect(await fp.hasData()).toBe(false)
    fp.destroy()
  })

  it("calls onRestore option when data is restored via attach", async () => {
    const driver = new MemoryDriver()
    const seed = new FormPersist(makeConfig({ storage: driver }))
    await seed.saveAll({ field: "value" })
    seed.destroy()

    const onRestore = jest.fn()
    const form = makeForm({ field: "" })
    const fp = new FormPersist(makeConfig({ storage: driver }))
    fp.attach(form, { onRestore })

    await new Promise((r) => setTimeout(r, 50))
    expect(onRestore).toHaveBeenCalled()
    fp.destroy()
  })
})

// ── quota error → fallback ────────────────────────────────────────────────────

describe("quota error falls back to fallback driver", () => {
  it("writes to fallback driver when primary throws QuotaExceededError", async () => {
    const primary = new MemoryDriver()
    const fallback = new MemoryDriver()

    const quota = Object.assign(new Error("quota"), { name: "QuotaExceededError" })
    jest.spyOn(primary, "set").mockRejectedValueOnce(quota)

    const fp = new FormPersist(makeConfig({ storage: primary, fallbackStorage: fallback }))
    await fp.saveAll({ x: 1 })

    const raw = await fallback.get("form-persist:browser-test-form")
    expect(raw).not.toBeNull()
    fp.destroy()
  })
})
