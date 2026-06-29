import { describe, expect, test } from "vitest"
import {
  competitionPrimaryEnd,
  competitionPrimaryStart,
} from "@/convex/competitions/dates"

describe("competition date boundaries", () => {
  test("uses the available endpoint for partial ranges", () => {
    expect(competitionPrimaryStart({ from: null, to: "2026-09-13" })).toBe(
      "2026-09-13"
    )
    expect(competitionPrimaryEnd({ from: "2026-09-12", to: null })).toBe(
      "2026-09-12"
    )
  })

  test("treats empty date values as absent", () => {
    expect(competitionPrimaryStart({ from: "", to: "2026-09-13" })).toBe(
      "2026-09-13"
    )
    expect(competitionPrimaryEnd({ from: "2026-09-12", to: "" })).toBe(
      "2026-09-12"
    )
  })
})
