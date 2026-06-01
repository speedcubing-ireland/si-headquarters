const MAX_STRING_LENGTH = 10000

export function sanitizeText(input: string | undefined | null): string {
  if (input === undefined || input === null) {
    return ""
  }

  return input.trim().replace(/[<>]/g, "").slice(0, MAX_STRING_LENGTH)
}

export function normalizeEmail(email: string | undefined | null): string {
  return (email ?? "").trim().toLowerCase()
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
