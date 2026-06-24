/**
 * Deep-merge `source` into `target`.
 * Arrays and primitives from source overwrite target; plain objects are merged recursively.
 * Used when restoring partial form data back into an existing form state.
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result: Record<string, unknown> = { ...target }
  for (const key of Object.keys(source)) {
    const srcVal = source[key as keyof T]
    const tgtVal = target[key as keyof T]
    if (
      srcVal !== null &&
      srcVal !== undefined &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal) &&
      typeof tgtVal === "object" &&
      tgtVal !== null &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as Record<string, unknown>
      )
    } else if (srcVal !== undefined) {
      result[key] = srcVal
    }
  }
  return result as T
}
