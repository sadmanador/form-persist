// AES-GCM 256-bit encryption using the Web Crypto API — no external dependencies.
// The derived key is cached per passphrase to avoid 100K PBKDF2 iterations on every save.

const PBKDF2_ITERATIONS = 100_000
// Lazy to avoid calling TextEncoder at module-load time (safe in all environments)
let _salt: Uint8Array | null = null
function getSalt(): Uint8Array {
  if (!_salt) _salt = new TextEncoder().encode("form-persist-salt-v1")
  return _salt
}

const keyCache = new Map<string, Promise<CryptoKey>>()

export function isWebCryptoAvailable(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as typeof globalThis & { crypto?: Crypto }).crypto !== "undefined" &&
    typeof (globalThis as typeof globalThis & { crypto?: Crypto }).crypto?.subtle !== "undefined"
  )
}

function getCrypto(): Crypto {
  const c = (globalThis as typeof globalThis & { crypto?: Crypto }).crypto
  if (!c) throw new Error("Web Crypto API is not available in this environment")
  return c
}

function deriveKey(passphrase: string): Promise<CryptoKey> {
  if (!keyCache.has(passphrase)) {
    const crypto = getCrypto()
    const promise = crypto.subtle
      .importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"])
      .then((keyMaterial) =>
        crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: getSalt(), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        )
      )
    keyCache.set(passphrase, promise)
  }
  return keyCache.get(passphrase)!
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    buf[i] = binary.charCodeAt(i)
  }
  return buf.buffer
}

export async function encryptValue(plaintext: string, passphrase: string): Promise<string> {
  const crypto = getCrypto()
  const key = await deriveKey(passphrase)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  )
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.byteLength)
  return bufferToBase64(combined.buffer)
}

export async function decryptValue(ciphertext: string, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase)
  const combined = new Uint8Array(base64ToBuffer(ciphertext))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const plaintext = await getCrypto().subtle.decrypt({ name: "AES-GCM", iv }, key, data)
  return new TextDecoder().decode(plaintext)
}

export async function encryptFields(
  data: Record<string, unknown>,
  passphrase: string,
  exclude: string[]
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (exclude.includes(k) || v === null || v === undefined) {
      result[k] = v
    } else {
      result[k] = await encryptValue(JSON.stringify(v), passphrase)
    }
  }
  return result
}

export async function decryptFields(
  data: Record<string, unknown>,
  passphrase: string,
  exclude: string[]
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (exclude.includes(k) || typeof v !== "string") {
      result[k] = v
    } else {
      try {
        result[k] = JSON.parse(await decryptValue(v, passphrase)) as unknown
      } catch {
        result[k] = v
      }
    }
  }
  return result
}
