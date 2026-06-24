// LZString compression algorithm — inline implementation, no external dependencies.
// Compresses form JSON by 60-80% before writing to storage.
//
// Important: literals decrement enlargeIn TWICE (inside the literal branch + the outer
// shared decrement below), while dictionary references decrement it only ONCE (outer
// shared decrement only). This asymmetry must be preserved exactly or the bit-width
// scheduler falls out of sync with the decompressor.

const BASE64_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
const BITS_PER_CHAR = 6
const RESET_VALUE = 32 // 2^(BITS_PER_CHAR-1)

function charToInt(c: string): number {
  return BASE64_KEYS.indexOf(c)
}

function intToChar(n: number): string {
  return BASE64_KEYS[n]
}

export function compress(uncompressed: string): string {
  if (!uncompressed) return ""

  const dictionary: Record<string, number> = {}
  const dictionaryToCreate: Record<string, boolean> = {}
  let w = ""
  let enlargeIn = 2
  let dictSize = 3
  let numBits = 2
  const output: string[] = []
  let dataVal = 0
  let dataPos = 0

  function writeBits(value: number, bitsToWrite: number): void {
    for (let i = 0; i < bitsToWrite; i++) {
      dataVal = (dataVal << 1) | (value & 1)
      value >>= 1
      if (dataPos === BITS_PER_CHAR - 1) {
        dataPos = 0
        output.push(intToChar(dataVal))
        dataVal = 0
      } else {
        dataPos++
      }
    }
  }

  function outputW(currentW: string): void {
    if (currentW in dictionaryToCreate) {
      const code = currentW.charCodeAt(0)
      if (code < 256) {
        writeBits(0, numBits) // 8-bit literal marker
        writeBits(code, 8)
      } else {
        writeBits(1, numBits) // 16-bit literal marker
        writeBits(code, 16)
      }
      // First decrement — literal branch only
      enlargeIn--
      if (enlargeIn === 0) {
        enlargeIn = 1 << numBits
        numBits++
      }
      delete dictionaryToCreate[currentW]
    } else {
      writeBits(dictionary[currentW], numBits)
      // References get NO decrement here — only the shared one below
    }
    // Shared decrement — applies to both literals and references
    enlargeIn--
    if (enlargeIn === 0) {
      enlargeIn = 1 << numBits
      numBits++
    }
  }

  for (let ii = 0; ii < uncompressed.length; ii++) {
    const c = uncompressed[ii]
    if (!(c in dictionary)) {
      dictionary[c] = dictSize++
      dictionaryToCreate[c] = true
    }

    const wc = w + c
    if (wc in dictionary) {
      w = wc
    } else {
      outputW(w)
      dictionary[wc] = dictSize++
      w = c
    }
  }

  if (w !== "") {
    outputW(w)
  }

  // End-of-stream marker (code 2) — no enlargeIn change
  writeBits(2, numBits)

  // Flush: left-shift zeros until the partial char buffer fills and emits
  while (true) {
    dataVal = dataVal << 1
    if (dataPos === BITS_PER_CHAR - 1) {
      output.push(intToChar(dataVal))
      break
    }
    dataPos++
  }

  return output.join("")
}

export function decompress(compressed: string): string {
  if (!compressed) return ""

  const length = compressed.length
  const data = {
    val: charToInt(compressed[0]),
    position: RESET_VALUE,
    index: 1,
  }

  function readBits(numBitsToRead: number): number {
    let bits = 0
    let power = 1
    const maxpower = 1 << numBitsToRead
    while (power !== maxpower) {
      const resb = data.val & data.position
      data.position >>= 1
      if (data.position === 0) {
        data.position = RESET_VALUE
        data.val = charToInt(compressed[data.index++])
      }
      bits |= (resb > 0 ? 1 : 0) * power
      power <<= 1
    }
    return bits
  }

  const dictionary: (string | number)[] = [0, 1, 2]
  let enlargeIn = 4
  let dictSize = 4
  let numBits = 3
  const result: string[] = []

  // Decode first character (always a literal — first token uses the initial numBits=2)
  const firstToken = readBits(2)
  let firstChar: string
  switch (firstToken) {
    case 0:
      firstChar = String.fromCharCode(readBits(8))
      break
    case 1:
      firstChar = String.fromCharCode(readBits(16))
      break
    case 2:
      return ""
    default:
      return ""
  }

  dictionary[3] = firstChar
  let w = firstChar
  result.push(firstChar)

  while (true) {
    if (data.index > length) return ""

    let c = readBits(numBits)

    switch (c) {
      case 0: {
        const ch = String.fromCharCode(readBits(8))
        dictionary[dictSize++] = ch
        c = dictSize - 1
        // Literal branch decrement (mirrors compressor's first decrement)
        enlargeIn--
        break
      }
      case 1: {
        const ch = String.fromCharCode(readBits(16))
        dictionary[dictSize++] = ch
        c = dictSize - 1
        enlargeIn--
        break
      }
      case 2:
        return result.join("")
    }

    // Shared decrement (mirrors compressor's second/only decrement)
    if (enlargeIn === 0) {
      enlargeIn = 1 << numBits
      numBits++
    }

    let entry: string
    if (dictionary[c] !== undefined && typeof dictionary[c] === "string") {
      entry = dictionary[c] as string
    } else if (c === dictSize) {
      // Sequence not yet in dictionary — it must be w + w[0]
      entry = w + w[0]
    } else {
      return ""
    }

    result.push(entry)
    dictionary[dictSize++] = w + entry[0]
    enlargeIn--

    if (enlargeIn === 0) {
      enlargeIn = 1 << numBits
      numBits++
    }

    w = entry
  }
}
