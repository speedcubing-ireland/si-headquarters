import { beforeEach, describe, expect, test, vi } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { resend } from "@/convex/sendEmails"
import type { ScheduleSponsorshipEmailBatchArgs } from "@/convex/plugins/sponsor/lib/validators"
import {
  claimSponsorshipEmailDispatchForRender,
  deliverSponsorshipEmailDispatch,
  recordSponsorshipEmailDispatchFailure,
  scheduleSponsorshipEmailBatch,
} from "./send"

const sendEmailMock = vi.spyOn(resend, "sendEmail")

interface DispatchRow {
  _id: Id<"sponsorshipEmailDispatches">
  dedupKey: string
  emailType: string
  recipientEmail: string
  recipientName?: string
  subject: string
  message: string
  sponsorId?: string
  auctionId?: string
  status: string
  attempts: number
  createdAt: number
  nextAttemptAt?: number
  lastAttemptAt?: number
  processingStartedAt?: number
  lastError?: string
  sentAt?: number
  failedAt?: number
  emailId?: string
}

function createCtx() {
  const dispatches: DispatchRow[] = []
  const scheduledCalls: { args: unknown; runAt?: number }[] = []

  const ctx = {
    db: {
      get: async (table: string, id: Id<"sponsorshipEmailDispatches">) => {
        if (table !== "sponsorshipEmailDispatches") {
          throw new Error(`Unexpected get table: ${table}`)
        }
        return dispatches.find((d) => d._id === id) ?? null
      },
      patch: async (
        table: string,
        id: Id<"sponsorshipEmailDispatches">,
        patch: Partial<DispatchRow>
      ) => {
        if (table !== "sponsorshipEmailDispatches") {
          throw new Error(`Unexpected patch table: ${table}`)
        }
        const dispatch = dispatches.find((d) => d._id === id)
        if (!dispatch) throw new Error(`dispatch not found: ${id}`)
        Object.assign(dispatch, patch)
      },
      query: (table: string) => {
        if (table !== "sponsorshipEmailDispatches") {
          throw new Error(`Unexpected query table: ${table}`)
        }
        return {
          withIndex: (
            _index: string,
            indexFn: (q: { eq: (field: string, value: string) => void }) => void
          ) => {
            const eqState = { value: "" }
            indexFn({
              eq: (_field: string, value: string) => {
                eqState.value = value
              },
            })
            return {
              first: async () =>
                dispatches.find((d) => d.dedupKey === eqState.value) ?? null,
            }
          },
        }
      },
      insert: async (table: string, doc: Record<string, unknown>) => {
        if (table !== "sponsorshipEmailDispatches") {
          throw new Error(`Unexpected insert table: ${table}`)
        }
        const _id =
          `dispatch-${String(dispatches.length)}` as Id<"sponsorshipEmailDispatches">
        dispatches.push({ _id, ...(doc as Omit<DispatchRow, "_id">) })
        return _id
      },
    },
    scheduler: {
      runAfter: async (_delayMs: number, _fnRef: unknown, args: unknown) => {
        scheduledCalls.push({ args })
      },
      runAt: async (runAt: number, _fnRef: unknown, args: unknown) => {
        scheduledCalls.push({ args, runAt })
      },
    },
  } as unknown as MutationCtx

  return { ctx, dispatches, scheduledCalls }
}

async function callHandler<T>(
  fn: unknown,
  ctx: MutationCtx,
  args: Record<string, unknown>
): Promise<T> {
  return await (
    fn as {
      _handler: (ctx: MutationCtx, args: Record<string, unknown>) => Promise<T>
    }
  )._handler(ctx, args)
}

function seedDispatch(
  dispatches: DispatchRow[],
  overrides: Partial<DispatchRow> = {}
): Id<"sponsorshipEmailDispatches"> {
  const id =
    overrides._id ??
    (`dispatch-${String(dispatches.length)}` as Id<"sponsorshipEmailDispatches">)
  dispatches.push({
    _id: id,
    dedupKey: `dedup-${String(dispatches.length)}`,
    emailType: "invite",
    recipientEmail: "sponsor@example.com",
    recipientName: "Sponsor",
    subject: "Subject",
    message: "Fallback",
    status: "pending",
    attempts: 0,
    createdAt: Date.now() - 1_000,
    nextAttemptAt: Date.now() - 1_000,
    ...overrides,
  })
  return id
}

const auctionArgs: ScheduleSponsorshipEmailBatchArgs = {
  auctionId: "auction1" as ScheduleSponsorshipEmailBatchArgs["auctionId"],
  emailType: "auction_closed_winner",
  subject: "You won",
  message: "fallback",
  recipients: [{ sponsorId: "sA" as never, email: "sA@example.com" }],
}

describe("scheduleSponsorshipEmailBatch — idempotency", () => {
  beforeEach(() => {
    sendEmailMock.mockReset()
  })

  test("enqueuing the same auction email twice creates one dispatch row", async () => {
    const { ctx, dispatches, scheduledCalls } = createCtx()

    await scheduleSponsorshipEmailBatch(ctx, auctionArgs)
    await scheduleSponsorshipEmailBatch(ctx, auctionArgs)

    expect(dispatches).toHaveLength(1)
    expect(dispatches[0].status).toBe("pending")
    expect(dispatches[0].recipientEmail).toBe("sa@example.com")
    expect(dispatches[0].nextAttemptAt).toBeTypeOf("number")
    expect(scheduledCalls).toHaveLength(2)
  })

  test("distinct sponsors get distinct rows", async () => {
    const { ctx, dispatches } = createCtx()

    await scheduleSponsorshipEmailBatch(ctx, {
      ...auctionArgs,
      recipients: [
        { sponsorId: "sA" as never, email: "sA@example.com" },
        { sponsorId: "sB" as never, email: "sB@example.com" },
      ],
    })

    expect(dispatches).toHaveLength(2)
    expect(new Set(dispatches.map((d) => d.dedupKey)).size).toBe(2)
  })

  test("non-auction invite dedupe is per contact email, not per sponsor", async () => {
    const { ctx, dispatches } = createCtx()

    await scheduleSponsorshipEmailBatch(ctx, {
      emailType: "invite",
      subject: "Sponsor portal access",
      message: "Open the portal",
      recipients: [
        { sponsorId: "sA" as never, email: "owner@example.com" },
        { sponsorId: "sA" as never, email: "billing@example.com" },
      ],
    })

    expect(dispatches).toHaveLength(2)
    expect(dispatches.map((d) => d.recipientEmail).sort()).toEqual([
      "billing@example.com",
      "owner@example.com",
    ])
    expect(new Set(dispatches.map((d) => d.dedupKey)).size).toBe(2)
    expect(dispatches.every((d) => d.dedupKey.startsWith("invite:"))).toBe(true)
  })

  test("blank recipient addresses are skipped", async () => {
    const { ctx, dispatches, scheduledCalls } = createCtx()

    await scheduleSponsorshipEmailBatch(ctx, {
      ...auctionArgs,
      recipients: [{ sponsorId: "sA" as never, email: "   " }],
    })

    expect(dispatches).toHaveLength(0)
    expect(scheduledCalls).toHaveLength(0)
  })
})

describe("sponsorship email dispatch processing", () => {
  beforeEach(() => {
    sendEmailMock.mockReset()
  })

  test("claims and delivers a pending dispatch", async () => {
    const { ctx, dispatches } = createCtx()
    const dispatchId = seedDispatch(dispatches)
    sendEmailMock.mockResolvedValue(
      "email-1" as Awaited<ReturnType<typeof resend.sendEmail>>
    )

    const renderInput = await callHandler(
      claimSponsorshipEmailDispatchForRender,
      ctx,
      { dispatchId }
    )

    expect(renderInput).toMatchObject({
      emailType: "invite",
      recipientName: "Sponsor",
      message: "Fallback",
    })
    expect(dispatches[0].status).toBe("processing")
    expect(dispatches[0].processingStartedAt).toBeTypeOf("number")

    await callHandler(deliverSponsorshipEmailDispatch, ctx, {
      dispatchId,
      html: "<p>Hello</p>",
      text: "Hello",
    })

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        to: "sponsor@example.com",
        subject: "Subject",
        html: "<p>Hello</p>",
        text: "Hello",
      })
    )
    expect(dispatches[0]).toMatchObject({
      status: "sent",
      emailId: "email-1",
      attempts: 1,
      processingStartedAt: undefined,
      nextAttemptAt: undefined,
      lastError: undefined,
    })
    expect(dispatches[0].sentAt).toBeTypeOf("number")
  })

  test("records render failures as pending retries", async () => {
    const { ctx, dispatches, scheduledCalls } = createCtx()
    const dispatchId = seedDispatch(dispatches, { status: "processing" })

    await callHandler(recordSponsorshipEmailDispatchFailure, ctx, {
      dispatchId,
      error: "render failed",
    })

    expect(dispatches[0].status).toBe("pending")
    expect(dispatches[0].attempts).toBe(1)
    expect(dispatches[0].lastError).toBe("render failed")
    expect(dispatches[0].processingStartedAt).toBeUndefined()
    expect(dispatches[0].nextAttemptAt).toBeGreaterThan(Date.now())
    expect(scheduledCalls).toHaveLength(1)
    expect(scheduledCalls[0].runAt).toBe(dispatches[0].nextAttemptAt)
  })

  test("marks a dispatch failed at the max attempt", async () => {
    const { ctx, dispatches, scheduledCalls } = createCtx()
    const dispatchId = seedDispatch(dispatches, {
      status: "processing",
      attempts: 4,
    })

    await callHandler(recordSponsorshipEmailDispatchFailure, ctx, {
      dispatchId,
      error: "provider failed",
    })

    expect(dispatches[0]).toMatchObject({
      status: "failed",
      attempts: 5,
      lastError: "provider failed",
      processingStartedAt: undefined,
      nextAttemptAt: undefined,
    })
    expect(dispatches[0].failedAt).toBeTypeOf("number")
    expect(scheduledCalls).toHaveLength(0)
  })

  test("does not claim a pending dispatch before nextAttemptAt", async () => {
    const { ctx, dispatches } = createCtx()
    const dispatchId = seedDispatch(dispatches, {
      nextAttemptAt: Date.now() + 60_000,
    })

    const renderInput = await callHandler(
      claimSponsorshipEmailDispatchForRender,
      ctx,
      { dispatchId }
    )

    expect(renderInput).toBeNull()
    expect(dispatches[0].status).toBe("pending")
    expect(dispatches[0].processingStartedAt).toBeUndefined()
  })
})
