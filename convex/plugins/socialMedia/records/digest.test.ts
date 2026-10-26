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

/** A tick with the clock at `nowMs`, which confirmations are timed by. */
async function tickAt(t: TestConvex<typeof schema>, nowMs: number) {
  vi.setSystemTime(nowMs)
  await tick(t, nowMs)
}

/** The text of an email's list under `title`, up to the next list or footer. */
function listText(
  email: SendEmailOptions,
  title: "CONFIRMED" | "PROVISIONAL"
): string {
  const text = email.text ?? ""
  const start = text.indexOf(title)
  if (start === -1) return ""
  const rest = text.slice(start)
  const end = rest.search(/\nPROVISIONAL|\nSent every Monday/)
  return end === -1 ? rest : rest.slice(0, end)
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

  test("lists the week's confirmed records apart from its provisional ones", async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "wcaRecords",
        wcaRecord({
          status: "confirmed",
          personName: "Ciara Byrne",
          liveCompetitionId: "88",
          competitionName: "Cork Open 2026",
          competitionStartDate: "2026-10-20",
          competitionEndDate: "2026-10-20",
        })
      )
    })
    stubWcaLive({ records: [recentRecord()] })

    await tickAt(t, at(8))

    const email = sentEmail()
    expect(email.subject).toBe("Records for Ireland: 19–25 Oct 2026 (2)")
    expect(listText(email, "CONFIRMED")).toContain("Ciara Byrne")
    expect(listText(email, "CONFIRMED")).not.toContain("Aoife Murphy")
    expect(listText(email, "PROVISIONAL")).toContain("Aoife Murphy")
    expect(listText(email, "PROVISIONAL")).not.toContain("Ciara Byrne")
  })

  test("lists a provisional record as confirmed in the next email after it is confirmed, once", async () => {
    const t = convexTest(schema, modules)
    const galway = {
      liveCompetitionId: "55",
      competitionName: "Galway Open 2026",
      competitionStartDate: "2026-10-17",
      competitionEndDate: "2026-10-18",
    }
    const fetchMock = stubWcaLive({ records: [recentRecord(galway)] })
    const week = 7 * 24 * 60 * 60_000

    // Reported as provisional on the Monday after the competition.
    await tickAt(t, at(8) - week)
    expect(listText(sentEmail(0), "PROVISIONAL")).toContain("GALWAY OPEN 2026")
    expect(listText(sentEmail(0), "CONFIRMED")).toBe("")

    // The WCA posts the results midweek.
    vi.setSystemTime(Date.UTC(2026, 9, 21, 9))
    const [row] = await t.run(
      async (ctx) => await ctx.db.query("wcaRecords").collect()
    )
    await t.mutation(
      internal.plugins.socialMedia.records.confirm.applyConfirmations,
      {
        confirmations: [
          {
            id: row._id,
            confirmation: {
              status: "confirmed",
              tag: "NR",
              attemptResult: 987,
              wcaId: "2015MURP01",
              personName: "Aoife Murphy",
            },
          },
        ],
      }
    )

    fetchMock.mockRestore()
    stubWcaLive({ records: [] })
    await tickAt(t, at(8))
    expect(sentEmail(1).subject).toBe("Records for Ireland: 19–25 Oct 2026 (1)")
    expect(listText(sentEmail(1), "CONFIRMED")).toContain("GALWAY OPEN 2026")
    expect(listText(sentEmail(1), "PROVISIONAL")).toBe("")

    await tickAt(t, at(8) + week)
    expect(sentEmail(2).subject).toBe(
      "No new records for Ireland: 26 Oct – 1 Nov 2026"
    )
  })

  test("leaves out earlier records imported already confirmed", async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "wcaRecords",
        wcaRecord({
          liveRecordId: "wca:1:single",
          status: "confirmed",
          liveCompetitionId: null,
          wcaCompetitionId: "Limerick2026",
          competitionName: "Limerick 2026",
          competitionStartDate: "2026-10-10",
          competitionEndDate: "2026-10-11",
        })
      )
    })
    stubWcaLive({ records: [] })

    await tickAt(t, at(8))

    expect(sentEmail().subject).toBe(
      "No new records for Ireland: 19–25 Oct 2026"
    )
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
      confirmedThrough: at(8),
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
