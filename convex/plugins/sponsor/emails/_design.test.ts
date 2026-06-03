import { describe, expect, test } from "vitest"
import { formatEmailDateTime } from "./_design"

describe("formatEmailDateTime", () => {
  test("uses en-IE calendar formatting in Europe/Dublin", () => {
    const winter = Date.UTC(2026, 0, 31, 14, 30)
    const formatted = formatEmailDateTime(winter)
    expect(formatted).not.toContain("1/31/2026")
    expect(formatted).not.toContain("01/31/2026")
    expect(formatted).toMatch(/\(.*\)$/)
  })

  test("appends Ireland timezone label in winter and summer", () => {
    const winter = Date.UTC(2026, 0, 15, 12, 0)
    const summer = Date.UTC(2026, 6, 15, 12, 0)
    expect(formatEmailDateTime(winter)).toContain("Ireland")
    expect(formatEmailDateTime(summer)).toContain("Ireland")
    expect(formatEmailDateTime(summer)).toContain("13:00")
    expect(formatEmailDateTime(winter)).toContain("12:00")
  })
})
