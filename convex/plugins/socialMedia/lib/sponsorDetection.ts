const SPONSOR_PATTERNS = [
  { pattern: /\bkewbz\b/i, label: "Kewbz" },
  { pattern: /\bu[\s-]*twist[\s-]*cubes?\b/i, label: "UTwistCubes" },
] as const

export function detectSponsorLabels(text: string): string[] {
  return SPONSOR_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ label }) => label
  )
}
