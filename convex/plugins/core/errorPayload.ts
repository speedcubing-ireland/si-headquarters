import { ConvexError } from "convex/values"

export function codeFromErrorPayload(
  // oxlint-disable-next-line typescript/no-restricted-types -- this validates arbitrary error payloads at the boundary
  value: unknown
): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string"
  ) {
    return value.code
  }
  return null
}

export function messageFromErrorPayload(
  // oxlint-disable-next-line typescript/no-restricted-types -- this validates arbitrary error payloads at the boundary
  value: unknown
): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message
  }
  return null
}

export function codeFromConvexError(
  // oxlint-disable-next-line typescript/no-restricted-types -- catch bindings are unknown
  error: unknown
): string | null {
  if (!(error instanceof ConvexError)) {
    return null
  }
  return codeFromErrorPayload(error.data)
}

export function messageFromJsonErrorPayload(message: string): string | null {
  if (!message.startsWith("{")) {
    return null
  }
  try {
    return messageFromErrorPayload(JSON.parse(message))
  } catch {
    return null
  }
}

export function unknownErrorMessage(
  // oxlint-disable-next-line typescript/no-restricted-types -- catch bindings are unknown
  error: unknown,
  options?: { includeConvexError?: boolean }
): string {
  if (options?.includeConvexError === true && error instanceof ConvexError) {
    const fromData = messageFromErrorPayload(error.data)
    if (fromData !== null) {
      return fromData
    }
  }
  if (error instanceof Error) {
    const fromJson = messageFromJsonErrorPayload(error.message)
    if (fromJson !== null) {
      return fromJson
    }
    return error.message
  }
  return String(error)
}
