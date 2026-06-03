import { ConvexError } from "convex/values"
import { components } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import {
  IMPERSONATION_SESSION_TTL_MS,
  IMPERSONATION_TICKET_TTL_MS,
  INVALID_IMPERSONATION_LINK_MESSAGE,
} from "@/convex/impersonation/validators"

export type ImpersonationTargetKind = "user" | "sponsor"
export type ImpersonationCtx = QueryCtx | MutationCtx

const MIN_CONSUMPTION_NONCE_LENGTH = 16
const MIN_TOKEN_LENGTH = 32

type JsonRecord = Record<string, string | number | boolean | null | undefined>

function invalidLink(): never {
  throw new ConvexError({
    code: "UNAUTHENTICATED",
    message: INVALID_IMPERSONATION_LINK_MESSAGE,
  })
}

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

export function normalizeConsumptionNonce(consumptionNonce: string): string {
  const normalized = consumptionNonce.trim()
  if (normalized.length < MIN_CONSUMPTION_NONCE_LENGTH) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Invalid login request.",
    })
  }
  return normalized
}

async function findTicketByToken(ctx: ImpersonationCtx, token: string) {
  const trimmed = token.trim()
  if (trimmed.length < MIN_TOKEN_LENGTH) {
    invalidLink()
  }
  const tokenHash = await hashToken(trimmed)
  const ticket = await ctx.db
    .query("impersonationSessions")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique()
  if (ticket === null) {
    invalidLink()
  }
  return { ticket, now: Date.now() }
}

export async function getConsumableUserTicket(
  ctx: MutationCtx,
  args: {
    token: string
    consumedByNonceHash: string
  }
) {
  const { ticket, now } = await findTicketByToken(ctx, args.token)
  if (
    ticket.target.type !== "user" ||
    ticket.ticketExpiresAt <= now ||
    ticket.revokedAt !== undefined
  ) {
    invalidLink()
  }
  if (ticket.redeemedAt === undefined) {
    return { ticket, alreadyConsumedByNonce: false, now }
  }
  if (ticket.consumedByNonceHash === args.consumedByNonceHash) {
    return { ticket, alreadyConsumedByNonce: true, now }
  }
  invalidLink()
}

export async function requireFreshTicket(
  ctx: ImpersonationCtx,
  args: {
    token: string
    targetType: ImpersonationTargetKind
  }
) {
  const { ticket, now } = await findTicketByToken(ctx, args.token)
  if (
    ticket.target.type !== args.targetType ||
    ticket.ticketExpiresAt <= now ||
    ticket.redeemedAt !== undefined ||
    ticket.revokedAt !== undefined
  ) {
    invalidLink()
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

export async function buildImpersonationBanner(
  ctx: ImpersonationCtx,
  args: {
    ticket: Doc<"impersonationSessions">
    actorUserId: Id<"users">
    expiresAt: number
  }
) {
  return {
    actorUserId: args.actorUserId,
    actorName: await getUserName(ctx, args.actorUserId),
    expiresAt: args.expiresAt,
    reason: args.ticket.reason,
  }
}

export function impersonationSessionIdFromSponsorSession(
  ctx: ImpersonationCtx,
  session: JsonRecord
) {
  const raw = session.impersonationSessionId
  return typeof raw === "string"
    ? ctx.db.normalizeId("impersonationSessions", raw)
    : null
}

export function userIdFromSponsorSession(ctx: ImpersonationCtx, session: JsonRecord) {
  const raw = session.impersonatedByUserId
  return typeof raw === "string" ? ctx.db.normalizeId("users", raw) : null
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

export async function redeemUserTicketForAuth(
  ctx: MutationCtx,
  args: { token: string; consumptionNonce: string }
) {
  const consumptionNonce = normalizeConsumptionNonce(args.consumptionNonce)
  const consumedByNonceHash = await hashToken(consumptionNonce)
  const { ticket, alreadyConsumedByNonce, now } = await getConsumableUserTicket(
    ctx,
    {
      token: args.token,
      consumedByNonceHash,
    }
  )
  if (ticket.target.type !== "user") {
    return null
  }
  const targetUser = await ctx.db.get("users", ticket.target.userId)
  if (targetUser === null || targetUser.disabled === true) {
    return null
  }

  if (alreadyConsumedByNonce) {
    const redeemedSession = ticket.redeemedSession
    if (redeemedSession?.kind !== "hq") {
      return null
    }
    return {
      userId: ticket.target.userId,
      sessionId: redeemedSession.authSessionId,
    }
  }

  const sessionId = await ctx.db.insert("authSessions", {
    userId: ticket.target.userId,
    expirationTime: ticket.sessionExpiresAt,
    impersonationSessionId: ticket._id,
    impersonatedByUserId: ticket.createdByUserId,
    impersonationExpiresAt: ticket.sessionExpiresAt,
  })
  await ctx.db.patch("impersonationSessions", ticket._id, {
    redeemedAt: now,
    redeemedSession: { kind: "hq", authSessionId: sessionId },
    consumedByNonceHash,
  })
  return {
    userId: ticket.target.userId,
    sessionId,
  }
}
