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
import { wcaRecord } from "@/convex/plugins/socialMedia/records/testFixtures"
import type { Record as WcaRecord } from "@/convex/plugins/wca/openapiClient/types.gen"

// Monday 26 Oct 2026, reporting on the week of 19–25 Oct. The clocks went back
// on the 25th, so local time is UTC again.
const MONDAY = Date.UTC(2026, 9, 26)
const at = (hour: number, minute = 50) => MONDAY + (hour * 60 + minute) * 60_000
const WEEK_START = "2026-10-19"
const POSTED_IN_WEEK = "2026-10-21T15:00:00.000Z"

function requestUrl(input: unknown): URL {
  if (typeof input === "string") return new URL(input)
  if (input instanceof URL) return input
  if (input instanceof Request) return new URL(input.url)
  throw new Error("Unexpected fetch input")
}

function byEvent(history: readonly WcaRecord[]): Record<string, WcaRecord[]> {
  const records: Record<string, WcaRecord[]> = {}
  for (const record of history) {
    ;(records[record.event_id] ??= []).push(record)
  }
  return records
}

/** Routes the two public WCA endpoints the digest calls. */
function stubWca(options: {
  history: WcaRecord[]
  postedAt?: Partial<Record<string, string>>
  failHistory?: boolean
}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = requestUrl(input)
    if (url.pathname.endsWith("/v0/results/records")) {
      if (options.failHistory === true) {
        return Response.json({ error: "unavailable" }, { status: 503 })
      }
      expect(url.searchParams.get("region")).toBe("Ireland")
      expect(url.searchParams.get("show")).toBe("history")
      return Response.json({
        records: byEvent(options.history),
        timestamp: "2026-10-26",
      })
    }
    if (url.pathname.endsWith("/v0/competition_index")) {
      const id = url.searchParams.get("q") ?? ""
      const postedAt = options.postedAt?.[id]
      // `q` is a substring search, so a longer id that contains it comes back
      // too; the digest must pick the exact one.
      return Response.json([
        { id: `${id}Extra`, results_posted_at: POSTED_IN_WEEK },
        {
          id,
          ...(postedAt === undefined ? {} : { results_posted_at: postedAt }),
        },
      ])
    }
    throw new Error(`Unexpected fetch to ${url.href}`)
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
    const fetchMock = stubWca({ history: [] })

    await tick(t, at(7))
    await tick(t, at(7) + 24 * 60 * 60_000)

    expect(await getRun(t)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  test("sends last week's records once", async () => {
    const t = convexTest(schema, modules)
    stubWca({
      history: [
        wcaRecord({ competition_id: "DublinOpen2026" }),
        wcaRecord({
          competition_id: "OldNews2026",
          competition_name: "Old News 2026",
        }),
      ],
      postedAt: {
        DublinOpen2026: POSTED_IN_WEEK,
        OldNews2026: "2026-10-12T15:00:00.000Z",
      },
    })

    await tick(t, at(8))
    await tick(t, at(9))

    expect(sendEmail).toHaveBeenCalledTimes(1)
    const email = sentEmail()
    expect(email).toMatchObject({
      from: "HQ <noreply@example.com>",
      to: ["social@example.com", "design@example.com"],
      subject: "Irish records: 19–25 Oct 2026 (1)",
    })
    expect(email.text).toContain("Aoife Murphy")
    expect(email.text).not.toContain("OLD NEWS 2026")
    expect(await getRun(t)).toMatchObject({
      status: "sent",
      attempts: 1,
      emailId: "email-1",
      recordCount: 1,
    })
  })

  test("says nothing happened when there were no records", async () => {
    const t = convexTest(schema, modules)
    stubWca({ history: [] })

    await tick(t, at(8))

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sentEmail().subject).toBe("No new Irish records: 19–25 Oct 2026")
    expect(await getRun(t)).toMatchObject({ status: "sent", recordCount: 0 })
  })

  test("retries a failed run on a later tick", async () => {
    const t = convexTest(schema, modules)
    const fetchMock = stubWca({ history: [], failHistory: true })

    await tick(t, at(8))
    expect(sendEmail).not.toHaveBeenCalled()
    expect(await getRun(t)).toMatchObject({
      status: "failed",
      attempts: 1,
      lastError: "WCA record history lookup failed.",
    })

    fetchMock.mockRestore()
    stubWca({ history: [] })
    await tick(t, at(9))

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(await getRun(t)).toMatchObject({ status: "sent", attempts: 2 })
  })

  test("gives up after the last attempt", async () => {
    const t = convexTest(schema, modules)
    stubWca({ history: [], failHistory: true })

    for (let hour = 8; hour < 8 + RECORD_DIGEST_MAX_ATTEMPTS + 2; hour += 1) {
      await tick(t, at(hour))
    }

    expect(await getRun(t)).toMatchObject({
      status: "failed",
      attempts: RECORD_DIGEST_MAX_ATTEMPTS,
    })
  })

  test("skips the week when no recipients are configured", async () => {
    vi.stubEnv("SOCIAL_MEDIA_RECORDS_EMAIL_TO", "")
    const t = convexTest(schema, modules)
    const fetchMock = stubWca({ history: [] })

    await tick(t, at(8))
    await tick(t, at(9))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
    const run = await getRun(t)
    expect(run).toMatchObject({ status: "skipped", attempts: 1 })
    expect(run?.lastError).toContain("SOCIAL_MEDIA_RECORDS_EMAIL_TO")
  })

  test("a superseded attempt cannot send", async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert("socialMediaRecordDigestRuns", {
        weekStart: WEEK_START,
        status: "running",
        attempts: 2,
        startedAt: at(9),
      })
    })

    await t.mutation(internal.plugins.socialMedia.records.digestState.deliver, {
      weekStart: WEEK_START,
      attempt: 1,
      from: "HQ <noreply@example.com>",
      to: ["social@example.com"],
      subject: "Stale",
      html: "<p>Stale</p>",
      text: "Stale",
      recordCount: 0,
    })

    expect(sendEmail).not.toHaveBeenCalled()
    expect(await getRun(t)).toMatchObject({ status: "running", attempts: 2 })
  })
})
