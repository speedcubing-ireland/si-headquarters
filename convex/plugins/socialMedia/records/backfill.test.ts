/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { describe, expect, test, vi } from "vitest"
import { internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import type { WcaRecord } from "@/convex/plugins/socialMedia/validators"
import { wcaRecord } from "@/convex/plugins/socialMedia/records/testFixtures"

vi.mock(
  "@/config/lib/organisation",
  () => import("@/config/lib/organisation.testFixture")
)

function importedRecord(overrides: Partial<WcaRecord> = {}): WcaRecord {
  return wcaRecord({
    liveRecordId: `wca:${overrides.eventId ?? "333"}:single`,
    status: "confirmed",
    liveCompetitionId: null,
    ...overrides,
  })
}

async function importHistory(
  t: TestConvex<typeof schema>,
  records: WcaRecord[],
  dryRun?: boolean
) {
  return await t.mutation(
    internal.plugins.socialMedia.records.backfill.importHistory,
    { records, dryRun }
  )
}

async function storedIds(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("wcaRecords").collect()).map((row) => row.liveRecordId)
  )
}

describe("importHistory", () => {
  test("adds the records once, so a re-run skips them", async () => {
    const t = convexTest(schema, modules)
    const records = [importedRecord(), importedRecord({ eventId: "222" })]

    expect(await importHistory(t, records)).toEqual({ inserted: 2, skipped: 0 })
    expect(await importHistory(t, records)).toEqual({ inserted: 0, skipped: 2 })
    expect(await storedIds(t)).toEqual(["wca:333:single", "wca:222:single"])
  })

  test("skips a record already stored from WCA Live", async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert("wcaRecords", wcaRecord({ status: "confirmed" }))
    })

    expect(
      await importHistory(t, [
        importedRecord(),
        // Set again later in the same event: a record of its own.
        importedRecord({ liveRecordId: "wca:43:single", attemptResult: 950 }),
      ])
    ).toEqual({ inserted: 1, skipped: 1 })
  })

  test("only counts on a dry run", async () => {
    const t = convexTest(schema, modules)

    expect(await importHistory(t, [importedRecord()], true)).toEqual({
      inserted: 1,
      skipped: 0,
    })
    expect(await storedIds(t)).toEqual([])
  })
})
