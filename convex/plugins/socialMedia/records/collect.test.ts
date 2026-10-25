import { describe, expect, test } from "vitest"
import {
  candidateRecords,
  RESULTS_POSTING_LOOKBACK_DAYS,
  selectRecordsPostedInWindow,
} from "@/convex/plugins/socialMedia/records/collect"
import { wcaRecord } from "@/convex/plugins/socialMedia/records/testFixtures"
import { weekWindowStartingOn } from "@/convex/plugins/socialMedia/records/window"
import { localDateOffset } from "@/convex/notifications/localTime"

const WEEK = weekWindowStartingOn("2026-10-19")
const INSIDE = "2026-10-21T15:00:00.000Z"

describe("candidateRecords", () => {
  test("keeps the country's recent records only", () => {
    const recent = wcaRecord({ start_date: "2026-10-17" })
    const atLookback = wcaRecord({
      start_date: localDateOffset("2026-10-19", -RESULTS_POSTING_LOOKBACK_DAYS),
    })
    const tooOld = wcaRecord({
      start_date: localDateOffset(
        "2026-10-19",
        -RESULTS_POSTING_LOOKBACK_DAYS - 1
      ),
    })
    const afterWeek = wcaRecord({ start_date: "2026-10-26" })
    const otherCountry = wcaRecord({ country_id: "United Kingdom" })

    expect(
      candidateRecords(
        [recent, atLookback, tooOld, afterWeek, otherCountry],
        "Ireland",
        WEEK
      )
    ).toEqual([recent, atLookback])
  })
})

describe("selectRecordsPostedInWindow", () => {
  test("keeps records from competitions posted inside the week only", () => {
    const posted = wcaRecord({ competition_id: "PostedThisWeek2026" })
    const earlier = wcaRecord({ competition_id: "PostedLastWeek2026" })
    const onEnd = wcaRecord({ competition_id: "PostedAtMidnight2026" })
    const unposted = wcaRecord({ competition_id: "NotPosted2026" })

    const selected = selectRecordsPostedInWindow(
      [posted, earlier, onEnd, unposted],
      new Map([
        ["PostedThisWeek2026", INSIDE],
        ["PostedLastWeek2026", "2026-10-18T22:59:59.000Z"],
        ["PostedAtMidnight2026", new Date(WEEK.endMs).toISOString()],
        ["NotPosted2026", null],
      ]),
      WEEK
    )

    expect(selected.map((competition) => competition.competitionId)).toEqual([
      "PostedThisWeek2026",
    ])
  })

  test("reads the marker matching each record's type", () => {
    const single = wcaRecord({
      type: "single",
      regional_single_record: "ER",
      regional_average_record: "NR",
      value: 512,
    })
    const average = wcaRecord({
      type: "average",
      regional_single_record: "ER",
      regional_average_record: "NR",
      value: 640,
    })
    const untyped = wcaRecord({
      type: undefined,
      event_id: "222",
      regional_single_record: null,
      regional_average_record: "WR",
      value: 101,
    })

    const selected = selectRecordsPostedInWindow(
      [average, untyped, single],
      new Map([["DublinOpen2026", INSIDE]]),
      WEEK
    )

    expect(selected).toHaveLength(1)
    expect(
      selected[0]?.records.map(({ eventId, type, marker, value }) => ({
        eventId,
        type,
        marker,
        value,
      }))
    ).toEqual([
      { eventId: "222", type: "average", marker: "WR", value: 101 },
      { eventId: "333", type: "single", marker: "ER", value: 512 },
      { eventId: "333", type: "average", marker: "NR", value: 640 },
    ])
  })

  test("lists every record from a competition in the order they were set", () => {
    const final = wcaRecord({ round_type_id: "f", value: 950 })
    const firstRound = wcaRecord({ round_type_id: "1", value: 980 })
    const otherComp = wcaRecord({
      competition_id: "CorkOpen2026",
      competition_name: "Cork Open 2026",
    })

    const selected = selectRecordsPostedInWindow(
      [final, otherComp, firstRound],
      new Map([
        ["DublinOpen2026", INSIDE],
        ["CorkOpen2026", INSIDE],
      ]),
      WEEK
    )

    expect(
      selected.map((competition) => [
        competition.competitionName,
        competition.records.map((record) => record.roundTypeId),
      ])
    ).toEqual([
      ["Cork Open 2026", ["f"]],
      ["Dublin Open 2026", ["1", "f"]],
    ])
  })
})
