import { describe, expect, test } from "vitest"
import { formatEmailDateTime } from "./_design"
import { organisationConfig } from "@/config/lib/organisation"

describe("formatEmailDateTime", () => {
  test("uses configured calendar formatting", () => {
    const winter = Date.UTC(2026, 0, 31, 14, 30)
    const formatted = formatEmailDateTime(winter)
    expect(formatted).not.toContain("1/31/2026")
    expect(formatted).not.toContain("01/31/2026")
    expect(formatted).toMatch(/\(.*\)$/)
  })

  test("appends configured timezone label in winter and summer", () => {
    const winter = Date.UTC(2026, 0, 15, 12, 0)
    const summer = Date.UTC(2026, 6, 15, 12, 0)
    const expectedWinter = new Intl.DateTimeFormat(
      organisationConfig.regional.locale,
      {
        timeZone: organisationConfig.regional.timeZone,
        timeZoneName: "longGeneric",
      }
    )
      .formatToParts(new Date(winter))
      .find((part) => part.type === "timeZoneName")?.value
    expect(formatEmailDateTime(winter)).toContain(
      expectedWinter ?? organisationConfig.regional.timeZoneLabel
    )
    const timeFormatter = new Intl.DateTimeFormat(
      organisationConfig.regional.locale,
      {
        timeZone: organisationConfig.regional.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }
    )
    expect(formatEmailDateTime(summer)).toContain(
      timeFormatter.format(new Date(summer))
    )
    expect(formatEmailDateTime(winter)).toContain(
      timeFormatter.format(new Date(winter))
    )
  })
})
