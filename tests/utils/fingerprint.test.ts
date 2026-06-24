/**
 * @jest-environment jsdom
 */
import { fingerprintForm } from "../../src/utils/fingerprint"

function makeForm(options: {
  action?: string
  method?: string
  id?: string
  fields?: string[]
} = {}): HTMLFormElement {
  const form = document.createElement("form")
  if (options.action) form.setAttribute("action", options.action)
  if (options.method) form.setAttribute("method", options.method)
  if (options.id) form.id = options.id
  for (const name of options.fields ?? []) {
    const input = document.createElement("input")
    input.name = name
    form.appendChild(input)
  }
  return form
}

describe("fingerprintForm", () => {
  it("returns a string starting with 'fp-'", () => {
    const form = makeForm()
    expect(fingerprintForm(form)).toMatch(/^fp-/)
  })

  it("produces the same fingerprint for identical forms", () => {
    const opts = { action: "/submit", method: "post", id: "my-form", fields: ["name", "email"] }
    expect(fingerprintForm(makeForm(opts))).toBe(fingerprintForm(makeForm(opts)))
  })

  it("produces different fingerprints for different actions", () => {
    const a = fingerprintForm(makeForm({ action: "/a" }))
    const b = fingerprintForm(makeForm({ action: "/b" }))
    expect(a).not.toBe(b)
  })

  it("produces different fingerprints for different field sets", () => {
    const a = fingerprintForm(makeForm({ fields: ["name"] }))
    const b = fingerprintForm(makeForm({ fields: ["email"] }))
    expect(a).not.toBe(b)
  })

  it("sorts field names before hashing (order-independent)", () => {
    const a = fingerprintForm(makeForm({ fields: ["name", "email"] }))
    const b = fingerprintForm(makeForm({ fields: ["email", "name"] }))
    expect(a).toBe(b)
  })

  it("uses method attribute (defaults to get)", () => {
    const withGet = fingerprintForm(makeForm({ method: "get" }))
    const noMethod = fingerprintForm(makeForm({}))
    expect(withGet).toBe(noMethod)
  })

  it("is case-insensitive for method", () => {
    const lower = fingerprintForm(makeForm({ method: "post" }))
    const upper = fingerprintForm(makeForm({ method: "POST" }))
    expect(lower).toBe(upper)
  })

  it("includes textarea and select elements in fingerprint", () => {
    const form = document.createElement("form")
    const textarea = document.createElement("textarea")
    textarea.name = "bio"
    const select = document.createElement("select")
    select.name = "country"
    form.appendChild(textarea)
    form.appendChild(select)

    const withFields = fingerprintForm(form)
    const empty = fingerprintForm(makeForm())
    expect(withFields).not.toBe(empty)
  })

  it("ignores unnamed elements", () => {
    const form = document.createElement("form")
    const namedInput = document.createElement("input")
    namedInput.name = "username"
    const unnamed = document.createElement("input")
    // no name attribute
    form.appendChild(namedInput)
    form.appendChild(unnamed)

    const withUnnamed = fingerprintForm(form)
    const withoutUnnamed = fingerprintForm(makeForm({ fields: ["username"] }))
    expect(withUnnamed).toBe(withoutUnnamed)
  })
})
