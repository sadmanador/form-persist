// Web Crypto (globalThis.crypto.subtle) is available in Node 18+.
// No jsdom needed — the node environment is sufficient.
import {
  isWebCryptoAvailable,
  encryptValue,
  decryptValue,
  encryptFields,
  decryptFields,
} from "../../src/core/Crypto"

const PASS = "test-passphrase-32chars-long!!"

describe("isWebCryptoAvailable", () => {
  it("returns true when Web Crypto API is available", () => {
    expect(isWebCryptoAvailable()).toBe(true)
  })

  it("returns false when globalThis.crypto is undefined", () => {
    const saved = (globalThis as Record<string, unknown>).crypto
    delete (globalThis as Record<string, unknown>).crypto
    try {
      expect(isWebCryptoAvailable()).toBe(false)
    } finally {
      ;(globalThis as Record<string, unknown>).crypto = saved
    }
  })

  it("returns false when globalThis.crypto.subtle is undefined", () => {
    const saved = (globalThis as Record<string, unknown>).crypto
    ;(globalThis as Record<string, unknown>).crypto = {}
    try {
      expect(isWebCryptoAvailable()).toBe(false)
    } finally {
      ;(globalThis as Record<string, unknown>).crypto = saved
    }
  })

  it("returns false when globalThis.crypto is null (covers optional-chaining null path)", () => {
    const saved = (globalThis as Record<string, unknown>).crypto
    ;(globalThis as Record<string, unknown>).crypto = null
    try {
      expect(isWebCryptoAvailable()).toBe(false)
    } finally {
      ;(globalThis as Record<string, unknown>).crypto = saved
    }
  })
})

describe("encryptValue / decryptValue", () => {
  it("round-trips a string", async () => {
    const cipher = await encryptValue("hello world", PASS)
    expect(cipher).not.toBe("hello world")
    expect(await decryptValue(cipher, PASS)).toBe("hello world")
  })

  it("produces different ciphertexts for the same input (random IV)", async () => {
    const c1 = await encryptValue("same", PASS)
    const c2 = await encryptValue("same", PASS)
    expect(c1).not.toBe(c2)
  })

  it("round-trips an empty string", async () => {
    const cipher = await encryptValue("", PASS)
    expect(await decryptValue(cipher, PASS)).toBe("")
  })

  it("caches the derived key — second encrypt is valid", async () => {
    const c = await encryptValue("x", PASS)
    expect(await decryptValue(c, PASS)).toBe("x")
    const c2 = await encryptValue("y", PASS)
    expect(await decryptValue(c2, PASS)).toBe("y")
  })

  it("getSalt reuses cached _salt across different passphrases (covers caching branch)", async () => {
    // First call with PASS already set _salt (branch 1: _salt is null → creates).
    // A fresh passphrase triggers a new deriveKey → getSalt is called again with
    // _salt already set → branch 2: !_salt is false → returns cached.
    const freshPass = "fresh-passphrase-16chars+"
    const c = await encryptValue("test", freshPass)
    expect(await decryptValue(c, freshPass)).toBe("test")
  })

  it("getCrypto throws and rejects encryptValue when Web Crypto is not available", async () => {
    const saved = (globalThis as Record<string, unknown>).crypto
    delete (globalThis as Record<string, unknown>).crypto
    // Use a passphrase not in keyCache so getCrypto() is called during deriveKey
    const neverUsedPass = "unique-pass-for-getCrypto-throw-test"
    try {
      await expect(encryptValue("data", neverUsedPass)).rejects.toThrow(
        "Web Crypto API is not available"
      )
    } finally {
      ;(globalThis as Record<string, unknown>).crypto = saved
    }
  })
})

describe("encryptFields / decryptFields", () => {
  it("encrypts string fields", async () => {
    const data = { name: "Alice" }
    const enc = await encryptFields(data, PASS, [])
    expect(typeof enc["name"]).toBe("string")
    expect(enc["name"]).not.toBe("Alice")
  })

  it("does not encrypt excluded fields", async () => {
    const data = { name: "Alice", password: "secret" }
    const enc = await encryptFields(data, PASS, ["password"])
    expect(enc["password"]).toBe("secret")
    expect(enc["name"]).not.toBe("Alice")
  })

  it("preserves null without encrypting", async () => {
    const data: Record<string, unknown> = { a: null }
    const enc = await encryptFields(data, PASS, [])
    expect(enc["a"]).toBeNull()
  })

  it("preserves undefined without encrypting", async () => {
    const data: Record<string, unknown> = { a: undefined }
    const enc = await encryptFields(data, PASS, [])
    expect(enc["a"]).toBeUndefined()
  })

  it("round-trips all scalar and nested types", async () => {
    const data = { str: "hello", num: 42, nested: { x: 1 } }
    const enc = await encryptFields(data, PASS, [])
    const dec = await decryptFields(enc, PASS, [])
    expect(dec["str"]).toBe("hello")
    expect(dec["num"]).toBe(42)
    expect(dec["nested"]).toEqual({ x: 1 })
  })

  it("decryptFields skips non-string (non-encrypted) values", async () => {
    const data: Record<string, unknown> = { count: 42 }
    const dec = await decryptFields(data, PASS, [])
    expect(dec["count"]).toBe(42)
  })

  it("decryptFields returns original value when decryption fails", async () => {
    const data = { field: "not-valid-ciphertext" }
    const dec = await decryptFields(data, PASS, [])
    expect(dec["field"]).toBe("not-valid-ciphertext")
  })

  it("decryptFields respects excluded fields", async () => {
    const data = { name: "Alice", password: "plain" }
    const enc = await encryptFields(data, PASS, ["password"])
    const dec = await decryptFields(enc, PASS, ["password"])
    expect(dec["name"]).toBe("Alice")
    expect(dec["password"]).toBe("plain")
  })
})
