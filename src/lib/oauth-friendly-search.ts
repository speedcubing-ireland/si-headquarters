export function parseOAuthFriendlySearch(searchStr: string) {
  const normalized = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr
  const params = new URLSearchParams(normalized)
  const result: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    result[key] = value
  }
  return result
}

export function stringifyOAuthFriendlySearch(
  search: Record<string, string | number | boolean | null | undefined>
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === "") {
      continue
    }
    params.set(key, typeof value === "string" ? value : String(value))
  }
  const serialized = params.toString()
  return serialized.length > 0 ? `?${serialized}` : ""
}
