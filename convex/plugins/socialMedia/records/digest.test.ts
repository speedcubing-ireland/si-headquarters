/// <reference types="vite/client" />
import type { EmailId, SendEmailOptions } from "@convex-dev/resend"
import { convexTest, type TestConvex } from "convex-test"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from "vitest"
import { internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import { resend } from "@/convex/sendEmails"
import { RECORD_DIGEST_MAX_ATTEMPTS } from "@/convex/plugins/socialMedia/records/digestState"
import type { RecentRecord } from "@/convex/plugins/socialMedia/records/collect"
import {
  recentRecord,
  wcaRecord,
} from "@/convex/plugins/socialMedia/records/testFixtures"

vi.mock(
  "@/config/lib/organisation",
  () => import("@/config/lib/organisation.testFixture")
)

// Monday 26 Oct 2026, reporting on the week of 19–25 Oct. The clocks went back
// on the 25th, so local time is UTC again.
const MONDAY = Date.UTC(2026, 9, 26)
const at = (hour: number, minute = 50) => MONDAY + (hour * 60 + minute) * 60_000
const WEEK_START = "2026-10-19"

/** Answers the WCA Live records query the digest makes. */
function stubWcaLive(options: { records: RecentRecord[]; fail?: boolean }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    expect(input).toBe("https://live.worldcubeassociation.org/api")
    if (options.fail === true) {
      return Response.json({ error: "unavailable" }, { status: 503 })
    }
    return Response.json({ data: { recentRecords: options.records } })
  })
}

async function tick(t: TestConvex<typeof schema>, nowMs: number) {
  await t.mutation(
    internal.plugins.socialMedia.records.digestState.queueWeeklyDigest,
    { nowMs }
  )
  await t.finishAllScheduledFunctions(() => vi.runAllTimers())
}

async function getRun(t: TestConvex<typeof schema>) {
  return await t.run(
    async (ctx) =>
      await ctx.db
        .query("socialMediaRecordDigestRuns")
        .withIndex("by_weekStart", (q) => q.eq("weekStart", WEEK_START))
        .unique()
  )
}

let sendEmail: MockInstance<typeof resend.sendEmail>

/** The options of the `index`th email handed to Resend. */
function sentEmail(index = 0): SendEmailOptions {
  // The spy is typed by `sendEmail`'s last overload, which takes positional
  // strings; the digest uses the options-object overload.
  const options: unknown = sendEmail.mock.calls[index]?.[1]
  if (typeof options !== "object" || options === null) {
    throw new Error(`Email ${String(index)} was not sent.`)
  }
  return options as SendEmailOptions
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv(
    "SOCIAL_MEDIA_RECORDS_EMAIL_TO",
    "social@example.com, design@example.com"
  )
  vi.stubEnv("SOCIAL_MEDIA_EMAIL_SENDER_ADDRESS", "HQ <noreply@example.com>")
  sendEmail = vi
    .spyOn(resend, "sendEmail")
    .mockResolvedValue("email-1" as EmailId)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("weekly records email", () => {
  test("waits for 08:00 local time on a Monday", async () => {
    const t = convexTest(schema, modules)
    const fetchMock = stubWcaLive({ records: [] })

    await tick(t, at(7))
    await tick(t, at(7) + 24 * 60 * 60_000)

    expect(await getRun(t)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  test("sends last week's records once", async () => {
    const t = convexTest(schema, modules)
    stubWcaLive({
      records: [
        recentRecord(),
        recentRecord({
          liveCompetitionId: "99",
          competitionName: "Old News 2026",
          competitionStartDate: "2026-10-17",
          competitionEndDate: "2026-10-18",
        }),
      ],
    })

    await tick(t, at(8))
    await tick(t, at(9))

    expect(sendEmail).toHaveBeenCalledTimes(1)
    const email = sentEmail()
    expect(email).toMatchObject({
      from: "HQ <noreply@example.com>",
      to: ["social@example.com", "design@example.com"],
      subject: "Records for Ireland: 19–25 Oct 2026 (1)",
    })
    expect(email.text).toContain("Aoife Murphy")
    expect(email.text).not.toContain("OLD NEWS 2026")
    expect(await getRun(t)).toMatchObject({
      status: "sent",
      failures: 0,
      emailId: "email-1",
      recordCount: 1,
    })
  })

  test("includes a week's records synced before they left WCA Live's feed", async () => {
    const t = convexTest(schema, modules)
    // Started before the Monday run's feed reaches back to, so only an earlier
    // sync saw it.
    await t.mutation(internal.plugins.socialMedia.records.store.saveSync, {
      records: [
        wcaRecord({
          liveCompetitionId: "77",
          competitionName: "Long Weekend 2026",
          competitionStartDate: "2026-10-15",
          competitionEndDate: "2026-10-19",
        }),
      ],
      syncedAt: Date.UTC(2026, 9, 20),
    })
    stubWcaLive({ records: [] })

    await tick(t, at(8))

    expect(sentEmail().subject).toBe("Records for Ireland: 19–25 Oct 2026 (1)")
    expect(sentEmail().text).toContain("LONG WEEKEND 2026")
  })

  test("says nothing happened when there were no records", async () => {
    const t = convexTest(schema, modules)
    stubWcaLive({ records: [] })

    await tick(t, at(8))

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sentEmail().subject).toBe(
      "No new records for Ireland: 19–25 Oct 2026"
    )
    expect(await getRun(t)).toMatchObject({ status: "sent", recordCount: 0 })
  })

  test("retries a failed run on a later tick", async () => {
    const t = convexTest(schema, modules)
    const fetchMock = stubWcaLive({ records: [], fail: true })

    await tick(t, at(8))
    expect(sendEmail).not.toHaveBeenCalled()
    expect(await getRun(t)).toMatchObject({
      status: "failed",
      failures: 1,
      lastError: "WCA Live recent records lookup failed (HTTP 503).",
    })

    fetchMock.mockRestore()
    stubWcaLive({ records: [] })
    await tick(t, at(9))

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(await getRun(t)).toMatchObject({ status: "sent", failures: 1 })
  })

  test("gives up after the last attempt", async () => {
    const t = convexTest(schema, modules)
    const fetchMock = stubWcaLive({ records: [], fail: true })

    for (let hour = 8; hour < 8 + RECORD_DIGEST_MAX_ATTEMPTS; hour += 1) {
      await tick(t, at(hour))
    }
    expect(await getRun(t)).toMatchObject({
      status: "failed",
      failures: RECORD_DIGEST_MAX_ATTEMPTS,
    })

    fetchMock.mockClear()
    await tick(t, at(8 + RECORD_DIGEST_MAX_ATTEMPTS))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("does nothing while the records email feature is off", async () => {
    const organisation = await import("@/config/lib/organisation")
    vi.spyOn(organisation, "isFeatureEnabled").mockImplementation(
      (feature) => feature !== "records"
    )
    const t = convexTest(schema, modules)
    const fetchMock = stubWcaLive({ records: [] })

    await tick(t, at(8))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(await getRun(t)).toBeNull()
  })

  test("never sends a week twice, even from overlapping runs", async () => {
    const t = convexTest(schema, modules)
    const email = {
      weekStart: WEEK_START,
      subject: "Records",
      html: "<p>Records</p>",
      text: "Records",
      recordCount: 0,
    }

    await t.mutation(
      internal.plugins.socialMedia.records.digestState.deliver,
      email
    )
    await t.mutation(
      internal.plugins.socialMedia.records.digestState.deliver,
      email
    )

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(await getRun(t)).toMatchObject({ status: "sent", failures: 0 })
  })
})
