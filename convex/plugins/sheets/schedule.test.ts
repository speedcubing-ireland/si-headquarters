import { describe, expect, test } from "vitest"
import {
  parseProgressionRows,
  parseScheduleEventRounds,
} from "@/convex/plugins/sheets/schedule"

describe("parseProgressionRows", () => {
  test("returns canonical, numeric event progression data", () => {
    expect(
      parseProgressionRows([
        [" 3x3 ", " 4 ", "100", "75", "20", ""],
        [],
        ["Pyraminx", "2"],
        ["Unknown", "3"],
        ["2x2", "not a number"],
        ["Clock", "3 rounds"],
      ])
    ).toEqual([
      {
        eventId: "333",
        roundCount: 4,
        progressions: [100, 75, 20, null],
      },
      {
        eventId: "pyram",
        roundCount: 2,
        progressions: [null, null, null, null],
      },
      {
        eventId: "222",
        roundCount: null,
        progressions: [null, null, null, null],
      },
      {
        eventId: "clock",
        roundCount: null,
        progressions: [null, null, null, null],
      },
    ])
  })

  test("preserves progression values independently of the report round count", () => {
    expect(parseProgressionRows([["3x3", "", "100", "75", "20"]])).toEqual([
      {
        eventId: "333",
        roundCount: null,
        progressions: [100, 75, 20, null],
      },
    ])
  })
})

describe("parseScheduleEventRounds", () => {
  test("returns only events with valid round counts", () => {
    expect(
      parseScheduleEventRounds([
        ["3x3", "4", "100", "75"],
        ["2x2", "not a number", "80", "40"],
      ])
    ).toEqual([{ eventId: "333", rounds: 4 }])
  })

  test("rejects duplicate event rows", () => {
    expect(() =>
      parseScheduleEventRounds([
        ["3x3", "4"],
        [" 3X3 ", "3"],
      ])
    ).toThrow(/duplicate event 333/)
  })
})
