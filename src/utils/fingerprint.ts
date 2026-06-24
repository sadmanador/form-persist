// djb2 hash — fast, collision-resistant enough for form fingerprinting
function djb2(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0 // unsigned 32-bit
  }
  return hash.toString(36)
}

/**
 * Derive a stable storage key from a form element's structure.
 * Used by FormPersist.attach() when no explicit key is provided.
 * The fingerprint is based on the form's action, method, id, and sorted field names.
 */
export function fingerprintForm(form: HTMLFormElement): string {
  const action = form.getAttribute("action") ?? ""
  const method = (form.getAttribute("method") ?? "get").toLowerCase()
  const id = form.id ?? ""

  const fieldNames = Array.from(form.elements)
    .filter(
      (el): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
    )
    .map((el) => el.name)
    .filter(Boolean)
    .sort()
    .join(",")

  return "fp-" + djb2(`${action}|${method}|${id}|${fieldNames}`)
}
