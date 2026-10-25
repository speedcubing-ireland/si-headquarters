import { describe, expect, test } from "vitest"
import {
  formatWeekLabel,
  weekToReport,
} from "@/convex/plugins/socialMedia/records/window"

// Tests run against the fixture organisation, which is on London time — the
// same offsets and DST dates as Dublin.
describe("weekToReport", () => {
  test("on a Monday is the Monday a week earlier", () => {
    expect(weekToReport(Date.UTC(2026, 9, 12, 8, 30))).toBe("2026-10-05")
  })

  test("is the week before the October clock change on the Monday after it", () => {
    expect(weekToReport(Date.UTC(2026, 9, 26, 8, 30))).toBe("2026-10-19")
  })

  test("is null on any other day", () => {
    expect(weekToReport(Date.UTC(2026, 9, 20, 8))).toBeNull()
    expect(weekToReport(Date.UTC(2026, 9, 25, 12))).toBeNull()
  })

  test("uses the local date, not the UTC one", () => {
    // 23:30 UTC on Sunday is already Monday in summer time.
    expect(weekToReport(Date.UTC(2026, 9, 18, 23, 30))).toBe("2026-10-12")
    expect(weekToReport(Date.UTC(2026, 9, 18, 22, 30))).toBeNull()
  })
})

describe("formatWeekLabel", () => {
  test("names the Monday to Sunday the week covers", () => {
    expect(formatWeekLabel("2026-10-19")).toBe("19–25 Oct 2026")
    expect(formatWeekLabel("2026-09-28")).toMatch(/^28 Sept? – 4 Oct 2026$/)
    expect(formatWeekLabel("2026-12-28")).toBe("28 Dec 2026 – 3 Jan 2027")
  })
})
