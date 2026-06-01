import { describe, expect, test } from "vitest"
import { saturdaysInYear, weekendLabel } from "@/convex/competitions/weekends"

describe("competitionWeekends", () => {
  test("lists each Saturday in a year", () => {
    expect(saturdaysInYear(2025)[0]).toBe("2025-01-04")
    expect(saturdaysInYear(2025).at(-1)).toBe("2025-12-27")
    expect(saturdaysInYear(2025)).toHaveLength(52)
  })

  test("weekend label spans month boundary", () => {
    expect(weekendLabel("2025-05-31")).toBe("May 31 – Jun 1")
  })
})
