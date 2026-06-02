import { describe, expect, test } from "vitest"
import { buildCheckinSheetRows } from "@/convex/plugins/wca/scheduleTransferCore"

describe("buildCheckinSheetRows", () => {
  test("maps accepted registration to full check-in columns", () => {
    const rows = buildCheckinSheetRows(
      [
        {
          id: 1,
          registrant_id: 1,
          user_id: 10,
          user: {
            id: 10,
            name: "Ada Lovelace",
            wca_id: "2016LOVE01",
            country_iso2: "IE",
            gender: "female",
          },
          competing: {
            event_ids: ["333", "222"],
            registration_status: "accepted",
          },
          guests: 0,
        },
      ],
      []
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.[0]).toBe("accepted")
    expect(rows[0]?.[1]).toBe("Ada Lovelace")
    expect(rows[0]?.[3]).toBe("2016LOVE01")
    expect(rows[0]?.[6]).toBe("1")
    expect(rows[0]?.[7]).toBe("1")
  })
})
