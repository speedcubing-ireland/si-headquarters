import { describe, expect, test } from "vitest"
import {
  formatWeekLabel,
  isLocalMonday,
  previousWeekWindow,
  weekWindowStartingOn,
} from "@/convex/plugins/socialMedia/records/window"

// Tests run against the fixture organisation, which is on London time — the
// same offsets and DST dates as Dublin.
describe("previousWeekWindow", () => {
  test("is last Monday-to-Monday in local time", () => {
    const window = previousWeekWindow(Date.UTC(2026, 9, 12, 8, 30))
    expect(window).toEqual({
      weekStart: "2026-10-05",
      startMs: Date.UTC(2026, 9, 4, 23),
      endMs: Date.UTC(2026, 9, 11, 23),
    })
  })

  test("from a Sunday is the week before the one ending that day", () => {
    expect(previousWeekWindow(Date.UTC(2026, 9, 25, 12)).weekStart).toBe(
      "2026-10-12"
    )
  })

  test("is 169 hours long across the October clock change", () => {
    const window = previousWeekWindow(Date.UTC(2026, 9, 26, 8, 30))
    expect(window.weekStart).toBe("2026-10-19")
    expect(window.startMs).toBe(Date.UTC(2026, 9, 18, 23))
    expect(window.endMs).toBe(Date.UTC(2026, 9, 26, 0))
  })

  test("is 167 hours long across the March clock change", () => {
    const window = weekWindowStartingOn("2026-03-23")
    expect(window.startMs).toBe(Date.UTC(2026, 2, 23, 0))
    expect(window.endMs).toBe(Date.UTC(2026, 2, 29, 23))
  })
})

describe("weekWindowStartingOn", () => {
  test("refuses a week that does not start on a Monday", () => {
    expect(() => weekWindowStartingOn("2026-10-20")).toThrow(/not a Monday/)
  })
})

describe("isLocalMonday", () => {
  test("uses the local date, not the UTC one", () => {
    // 23:30 UTC on Sunday is already Monday in summer time.
    expect(isLocalMonday(Date.UTC(2026, 9, 18, 23, 30))).toBe(true)
    expect(isLocalMonday(Date.UTC(2026, 9, 18, 22, 30))).toBe(false)
    expect(isLocalMonday(Date.UTC(2026, 9, 20, 8))).toBe(false)
  })
})

describe("formatWeekLabel", () => {
  test("names the Monday to Sunday the week covers", () => {
    expect(formatWeekLabel(weekWindowStartingOn("2026-10-19"))).toBe(
      "19–25 Oct 2026"
    )
    expect(formatWeekLabel(weekWindowStartingOn("2026-09-28"))).toMatch(
      // ICU spaces a cross-month range with thin spaces.
      /^28 Sept?\s–\s4 Oct 2026$/
    )
  })
})
