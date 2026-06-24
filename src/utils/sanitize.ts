/** Strip excluded fields from a data object before writing to storage. */
export function sanitizeData(
  data: Record<string, unknown>,
  exclude: string[]
): Record<string, unknown> {
  if (!exclude.length) return data
  const result = { ...data }
  for (const field of exclude) {
    delete result[field]
  }
  return result
}
