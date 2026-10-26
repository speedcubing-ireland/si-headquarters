import { describe, expect, test } from "vitest"
import { groupByCompetition } from "@/convex/plugins/socialMedia/records/collect"
import {
  renderWeeklyRecordsEmail,
  type WeeklyRecords,
} from "@/convex/plugins/socialMedia/records/email"
import { wcaRecord } from "@/convex/plugins/socialMedia/records/testFixtures"
import type { WcaRecord } from "@/convex/plugins/socialMedia/validators"

const WEEK = "2026-10-19"

/** Weekly records with only provisional ones. */
function provisional(records: WcaRecord[]): WeeklyRecords {
  return { confirmed: [], provisional: groupByCompetition(records) }
}

describe("renderWeeklyRecordsEmail", () => {
  test("lists each record with its competitor, result and record", async () => {
    const email = await renderWeeklyRecordsEmail(
      provisional([
        wcaRecord(),
        wcaRecord({
          wcaId: null,
          personName: "Seán Kelly",
          eventId: "333fm",
          type: "average",
          attemptResult: 2433,
          tag: "CR",
        }),
      ]),
      "IE",
      WEEK
    )

    expect(email.subject).toBe("Records for Ireland: 19–25 Oct 2026 (2)")
    expect(email.recordCount).toBe(2)
    // Plain text renders headings in capitals.
    expect(email.text).toContain("DUBLIN OPEN 2026")
    expect(email.text).toContain("Aoife Murphy")
    expect(email.text).toContain("NR")
    expect(email.text).toContain("3x3x3 Cube single 9.87 (Final)")
    expect(email.text).toContain("Seán Kelly")
    expect(email.text).toContain("CR")
    expect(email.text).toContain("3x3x3 Fewest Moves average 24.33 (Final)")
    expect(email.html).toContain("/persons/2015MURP01")
    // A newcomer has no WCA profile to link to.
    expect(email.html).not.toContain("/persons/null")
    expect(email.html).toContain(
      "https://live.worldcubeassociation.org/competitions/101"
    )
    expect(email.text).toContain("As entered on WCA Live")
  })

  test("links a competition to the WCA once its results are posted", async () => {
    const email = await renderWeeklyRecordsEmail(
      {
        confirmed: groupByCompetition([wcaRecord({ status: "confirmed" })]),
        provisional: [],
      },
      "IE",
      WEEK
    )

    expect(email.html).toContain(
      "https://www.worldcubeassociation.org/competitions/DublinOpen2026/results/all"
    )
    expect(email.html).not.toContain("live.worldcubeassociation.org")
  })

  test("lists confirmed records apart from provisional ones", async () => {
    const email = await renderWeeklyRecordsEmail(
      {
        confirmed: groupByCompetition([
          wcaRecord({
            status: "confirmed",
            personName: "Ciara Byrne",
            liveCompetitionId: "88",
            competitionName: "Cork Open 2026",
            competitionStartDate: "2026-10-17",
            competitionEndDate: "2026-10-18",
          }),
        ]),
        provisional: groupByCompetition([wcaRecord()]),
      },
      "IE",
      WEEK
    )

    expect(email.subject).toBe("Records for Ireland: 19–25 Oct 2026 (2)")
    expect(email.recordCount).toBe(2)
    const confirmedAt = email.text.indexOf("CONFIRMED")
    const provisionalAt = email.text.indexOf("PROVISIONAL")
    expect(confirmedAt).toBeGreaterThanOrEqual(0)
    expect(provisionalAt).toBeGreaterThan(confirmedAt)
    const ciara = email.text.indexOf("Ciara Byrne")
    expect(ciara).toBeGreaterThan(confirmedAt)
    expect(ciara).toBeLessThan(provisionalAt)
    expect(email.text.indexOf("Aoife Murphy")).toBeGreaterThan(provisionalAt)
  })

  test("leaves out a list with no records", async () => {
    const email = await renderWeeklyRecordsEmail(
      provisional([wcaRecord()]),
      "IE",
      WEEK
    )

    expect(email.text).toContain("PROVISIONAL")
    expect(email.text).not.toContain("CONFIRMED")
  })

  test("says so when there were no records", async () => {
    const email = await renderWeeklyRecordsEmail(
      { confirmed: [], provisional: [] },
      "IE",
      WEEK
    )

    expect(email.subject).toBe("No new records for Ireland: 19–25 Oct 2026")
    expect(email.text).toContain(
      "No competitor from Ireland set an NR, CR or WR at a competition that ended in the week of 19–25 Oct 2026."
    )
  })
})
