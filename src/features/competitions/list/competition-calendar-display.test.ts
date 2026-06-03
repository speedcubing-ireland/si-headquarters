import { describe, expect, test } from "vitest"
import {
  getCalendarMonthKey,
  getCompetitionDateChip,
  getInitialScrollMonthKey,
} from "@/features/competitions/list/competition-calendar-display"

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

describe("getCalendarMonthKey", () => {
  test("formats year and zero-padded month", () => {
    expect(getCalendarMonthKey(2026, 0)).toBe("2026-01")
    expect(getCalendarMonthKey(2026, 11)).toBe("2026-12")
  })
})

describe("getInitialScrollMonthKey", () => {
  test("returns current month key for the current year", () => {
    expect(
      getInitialScrollMonthKey(2026, new Date("2026-06-03T12:00:00"))
    ).toBe("2026-06")
  })

  test("returns null for other years", () => {
    expect(
      getInitialScrollMonthKey(2025, new Date("2026-06-03T12:00:00"))
    ).toBeNull()
    expect(
      getInitialScrollMonthKey(2027, new Date("2026-06-03T12:00:00"))
    ).toBeNull()
  })
})
