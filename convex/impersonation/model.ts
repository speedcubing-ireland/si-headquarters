import { ConvexError } from "convex/values"
import { components } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import {
  IMPERSONATION_SESSION_TTL_MS,
  IMPERSONATION_TICKET_TTL_MS,
} from "@/convex/impersonation/validators"

export type ImpersonationTargetKind = "user" | "sponsor"
export type ImpersonationCtx = QueryCtx | MutationCtx

type JsonRecord = Record<string, string | number | boolean | null | undefined>

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function createToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

export async function hashToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest("SHA-256", encoded)
  return bytesToHex(new Uint8Array(digest))
}

export function normalizeReason(reason: string): string {
  const trimmed = reason.trim()
  if (trimmed.length < 3) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "A reason is required.",
    })
  }
  if (trimmed.length > 500) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Reason must be 500 characters or fewer.",
    })
  }
  return trimmed
}

export async function requireFreshTicket(
  ctx: ImpersonationCtx,
  args: {
    token: string
    targetType: ImpersonationTargetKind
  }
) {
  const tokenHash = await hashToken(args.token)
  const ticket = await ctx.db
    .query("impersonationSessions")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique()
  const now = Date.now()
  if (
    ticket?.target.type !== args.targetType ||
    ticket.ticketExpiresAt <= now ||
    ticket.redeemedAt !== undefined ||
    ticket.revokedAt !== undefined
  ) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Impersonation link is invalid or expired.",
    })
  }
  return { ticket, now }
}

function isJsonRecord(value: object): value is JsonRecord {
  return !Array.isArray(value)
}

export async function findSponsorSessionByToken(
  ctx: ImpersonationCtx,
  sessionToken: string
) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- adapter boundary
  const result: object | null = await ctx.runQuery(
    components.sponsorAuth.adapter.findOne,
    {
      model: "session",
      where: [{ field: "token", value: sessionToken }],
    }
  )
  return result !== null && isJsonRecord(result) ? result : null
}

export async function findSponsorAuthUser(
  ctx: ImpersonationCtx,
  authUserId: string
) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- adapter boundary
  const result: object | null = await ctx.runQuery(
    components.sponsorAuth.adapter.findOne,
    {
      model: "user",
      where: [{ field: "_id", value: authUserId }],
    }
  )
  return result !== null && isJsonRecord(result) ? result : null
}

export async function getUserName(
  ctx: ImpersonationCtx,
  userId: Id<"users">
): Promise<string> {
  const user = await ctx.db.get("users", userId)
  return user?.name ?? user?.email ?? "Director"
}

export function normalizeImpersonationSessionId(
  ctx: ImpersonationCtx,
  value: string
) {
  return ctx.db.normalizeId("impersonationSessions", value)
}

export function normalizeUserId(ctx: ImpersonationCtx, value: string) {
  return ctx.db.normalizeId("users", value)
}

export async function insertImpersonationTicket(
  ctx: MutationCtx,
  args: {
    actorId: Id<"users">
    reason: string
    target: Doc<"impersonationSessions">["target"]
  }
) {
  const now = Date.now()
  const token = createToken()
  const ticketExpiresAt = now + IMPERSONATION_TICKET_TTL_MS
  const sessionExpiresAt = now + IMPERSONATION_SESSION_TTL_MS
  await ctx.db.insert("impersonationSessions", {
    target: args.target,
    createdByUserId: args.actorId,
    reason: normalizeReason(args.reason),
    tokenHash: await hashToken(token),
    ticketExpiresAt,
    sessionExpiresAt,
    createdAt: now,
  })
  return { token, ticketExpiresAt, sessionExpiresAt }
}

export function impersonationLinkResult(
  baseUrl: string,
  path: string,
  token: string,
  ticketExpiresAt: number,
  sessionExpiresAt: number
) {
  return {
    url: `${baseUrl}${path}?token=${encodeURIComponent(token)}`,
    ticketExpiresAt,
    sessionExpiresAt,
  }
}
