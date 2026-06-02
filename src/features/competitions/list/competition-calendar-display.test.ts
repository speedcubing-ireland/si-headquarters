import { describe, expect, test } from "vitest"
import { getCompetitionDateChip } from "@/features/competitions/list/competition-calendar-display"

function rowWithDates(from: string | null, to: string | null) {
  return { compDates: { from, to } }
}

describe("getCompetitionDateChip", () => {
  test("single day", () => {
    expect(
      getCompetitionDateChip(rowWithDates("2026-03-21", "2026-03-21"))
    ).toEqual({
      kind: "single",
      month: "MAR",
      day: "21",
    })
  })

  test("range within one month", () => {
    expect(
      getCompetitionDateChip(rowWithDates("2026-03-20", "2026-03-22"))
    ).toEqual({
      kind: "range",
      month: "MAR",
      startDay: "20",
      endDay: "22",
    })
  })

  test("range spanning two months", () => {
    expect(
      getCompetitionDateChip(rowWithDates("2026-02-28", "2026-03-02"))
    ).toEqual({
      kind: "span",
      startMonth: "FEB",
      startDay: "28",
      endMonth: "MAR",
      endDay: "2",
    })
  })

  test("missing dates", () => {
    expect(getCompetitionDateChip(rowWithDates(null, null))).toEqual({
      kind: "tbd",
    })
  })
})
