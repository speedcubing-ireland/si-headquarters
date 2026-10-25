import { describe, expect, test } from "vitest"
import { groupByCompetition } from "@/convex/plugins/socialMedia/records/collect"
import { renderWeeklyRecordsEmail } from "@/convex/plugins/socialMedia/records/email"
import { wcaRecord } from "@/convex/plugins/socialMedia/records/testFixtures"

const WEEK = "2026-10-19"

describe("renderWeeklyRecordsEmail", () => {
  test("lists each record with its competitor, result and record", async () => {
    const email = await renderWeeklyRecordsEmail(
      groupByCompetition([
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
    expect(email.text).toContain("as entered on WCA Live")
  })

  test("links a competition to the WCA once its results are posted", async () => {
    const email = await renderWeeklyRecordsEmail(
      groupByCompetition([wcaRecord({ status: "confirmed" })]),
      "IE",
      WEEK
    )

    expect(email.html).toContain(
      "https://www.worldcubeassociation.org/competitions/DublinOpen2026/results/all"
    )
    expect(email.html).not.toContain("live.worldcubeassociation.org")
  })

  test("says so when there were no records", async () => {
    const email = await renderWeeklyRecordsEmail([], "IE", WEEK)

    expect(email.subject).toBe("No new records for Ireland: 19–25 Oct 2026")
    expect(email.text).toContain(
      "No competitor from Ireland set an NR, CR or WR at a competition that ended in the week of 19–25 Oct 2026."
    )
  })
})
