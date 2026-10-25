import { describe, expect, test } from "vitest"
import type { WeeklyRecord } from "@/convex/plugins/socialMedia/records/collect"
import { renderWeeklyRecordsEmail } from "@/convex/plugins/socialMedia/records/email"
import { weekWindowStartingOn } from "@/convex/plugins/socialMedia/records/window"

const WEEK = weekWindowStartingOn("2026-10-19")

function weeklyRecord(overrides: Partial<WeeklyRecord> = {}): WeeklyRecord {
  return {
    personId: "2015MURP01",
    personName: "Aoife Murphy",
    eventId: "333",
    roundTypeId: "f",
    type: "single",
    value: 987,
    marker: "NR",
    ...overrides,
  }
}

describe("renderWeeklyRecordsEmail", () => {
  test("lists each record with its competitor, result and record", async () => {
    const email = await renderWeeklyRecordsEmail(
      [
        {
          competitionId: "DublinOpen2026",
          competitionName: "Dublin Open 2026",
          records: [
            weeklyRecord(),
            weeklyRecord({
              personId: "2012KELL02",
              personName: "Seán Kelly",
              eventId: "333fm",
              type: "average",
              value: 2433,
              marker: "ER",
            }),
          ],
        },
      ],
      "IE",
      WEEK
    )

    expect(email.subject).toBe("Records for Ireland: 19–25 Oct 2026 (2)")
    // Plain text renders headings in capitals.
    expect(email.text).toContain("DUBLIN OPEN 2026")
    expect(email.text).toContain("Aoife Murphy")
    expect(email.text).toContain("NR")
    expect(email.text).toContain("3x3x3 Cube single 9.87 (Final)")
    expect(email.text).toContain("Seán Kelly")
    expect(email.text).toContain("CR (ER)")
    expect(email.text).toContain("3x3x3 Fewest Moves average 24.33 (Final)")
    expect(email.html).toContain("/persons/2015MURP01")
    expect(email.html).toContain("/competitions/DublinOpen2026/results/all")
  })

  test("says so when there were no records", async () => {
    const email = await renderWeeklyRecordsEmail([], "IE", WEEK)

    expect(email.subject).toBe("No new records for Ireland: 19–25 Oct 2026")
    expect(email.text).toContain(
      "No competitor from Ireland set an NR, CR or WR at a competition whose results were posted in the week of 19–25 Oct 2026."
    )
  })
})
