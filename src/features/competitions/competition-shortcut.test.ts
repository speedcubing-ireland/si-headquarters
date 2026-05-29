import { describe, expect, it } from "vitest"
import { formatCompetitionShortcut } from "@/features/competitions/competition-shortcut"

describe("formatCompetitionShortcut", () => {
  it("builds initials plus two-digit year", () => {
    expect(formatCompetitionShortcut("my cool comp 2026", 2026)).toBe("MCC26")
  })

  it("ignores year token in name when computing initials", () => {
    expect(formatCompetitionShortcut("Dublin Open", 2025)).toBe("DO25")
  })
})
