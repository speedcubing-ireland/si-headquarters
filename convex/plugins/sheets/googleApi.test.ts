import { afterEach, describe, expect, test, vi } from "vitest"
import {
  fetchSchedule,
  fetchScheduleProgression,
} from "@/convex/plugins/sheets/googleApi"

afterEach(() => {
  vi.restoreAllMocks()
})

function mockBatchGet(valueRanges: object[]) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json({ spreadsheetId: "sheet", valueRanges }))
}

describe("fetchScheduleProgression", () => {
  test("reads rows even though Google echoes the range resolved to the sheet size", async () => {
    mockBatchGet([
      {
        range: "Schedule!A2:F1000",
        majorDimension: "ROWS",
        values: [
          ["Event", "Rounds"],
          ["3x3", "1", "80"],
        ],
      },
    ])

    await expect(fetchScheduleProgression("token", "sheet")).resolves.toEqual([
      ["Event", "Rounds"],
      ["3x3", "1", "80"],
    ])
  })
})

describe("fetchSchedule", () => {
  test("matches each result to its requested range by position", async () => {
    mockBatchGet([
      { range: "Schedule!AH6:AK1000", values: [["saturday"]] },
      { range: "Schedule!AM6:AP1000" },
      { range: "Schedule!A2:F1000", values: [["3x3", "1"]] },
    ])

    await expect(fetchSchedule("token", "sheet")).resolves.toEqual({
      saturday: [["saturday"]],
      sunday: [],
      progression: [["3x3", "1"]],
    })
  })

  test("fails loudly when Google returns a different number of ranges", async () => {
    mockBatchGet([{ range: "Schedule!AH6:AK1000", values: [] }])

    await expect(fetchSchedule("token", "sheet")).rejects.toThrow(
      "Google Sheets returned 1 ranges for 3 requested."
    )
  })
})
