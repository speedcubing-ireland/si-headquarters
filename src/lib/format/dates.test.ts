import { describe, expect, test } from "vitest"
import { format, parse } from "date-fns"
import { enIE } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"
import { formatDate, formatDateRange } from "./dates"

const formatOptions = { locale: enIE }

describe("formatDate", () => {
  test("formats date-only strings as calendar dates regardless of org timezone", () => {
    const expected = format(
      parse("2026-01-31", "yyyy-MM-dd", new Date()),
      "d MMM yyyy",
      formatOptions
    )

    const buggyWestern = formatInTimeZone(
      new Date("2026-01-31"),
      "America/New_York",
      "d MMM yyyy",
      formatOptions
    )

    expect(buggyWestern).toBe("30 Jan 2026")
    expect(formatDate("2026-01-31")).toBe(expected)
    expect(formatDate("2026-01-31")).not.toContain("1/31")
  })

  test("returns TBC for empty string", () => {
    expect(formatDate("")).toBe("TBC")
  })

  test("returns TBC for whitespace-only string", () => {
    expect(formatDate("   ")).toBe("TBC")
  })

  test("returns original string for an invalid date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date")
  })

  test("returns original string for an invalid calendar date", () => {
    expect(formatDate("2026-02-30")).toBe("2026-02-30")
  })
})

describe("formatDateRange", () => {
  test("returns a single date when start equals end", () => {
    const result = formatDateRange("2026-01-31", "2026-01-31")
    expect(result).toBe(formatDate("2026-01-31"))
    expect(result).not.toContain(" to ")
  })

  test("returns range string when start differs from end", () => {
    const result = formatDateRange("2026-01-31", "2026-02-01")
    expect(result).toContain(" to ")
    expect(result).not.toContain("/")
  })
})
