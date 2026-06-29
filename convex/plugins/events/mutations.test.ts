import { internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

describe("event schedule snapshots", () => {
  test("upserts one snapshot per sheet", async () => {
    const t = convexTest(schema, modules)

    await t.mutation(internal.plugins.events.mutations.saveScheduleSnapshots, {
      snapshots: [
        {
          sheetId: "sheet-id",
          events: [{ eventId: "333", rounds: 3 }],
          fetchedAt: 1,
        },
      ],
    })
    await t.mutation(internal.plugins.events.mutations.saveScheduleSnapshots, {
      snapshots: [
        {
          sheetId: "sheet-id",
          events: [{ eventId: "333", rounds: 4 }],
          fetchedAt: 2,
        },
      ],
    })

    const snapshots = await t.run((ctx) =>
      ctx.db.query("eventScheduleSnapshots").collect()
    )
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatchObject({
      sheetId: "sheet-id",
      events: [{ eventId: "333", rounds: 4 }],
      fetchedAt: 2,
    })
  })

  test("rejects duplicate events at the persistence boundary", async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(internal.plugins.events.mutations.saveScheduleSnapshots, {
        snapshots: [
          {
            sheetId: "sheet-id",
            events: [
              { eventId: "333", rounds: 4 },
              { eventId: "333", rounds: 3 },
            ],
            fetchedAt: 1,
          },
        ],
      })
    ).rejects.toMatchObject({
      data: { code: "CONFLICT" },
    })
  })
})
