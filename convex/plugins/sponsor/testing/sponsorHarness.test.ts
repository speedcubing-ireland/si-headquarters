/**
 * Shared convex-test harness for sponsor plugin integration tests.
 * Use `*.behavior.test.ts` for DB-backed flows; unit tests stay beside modules.
 * This file uses a `.test.ts` suffix so Convex does not bundle it for deployment.
 */
import { convexTest } from "convex-test"
import type { TestConvex } from "convex-test"
import { components } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import schema from "@/convex/schema"
import sponsorAuthSchema from "@/convex/plugins/sponsor/auth/component/sponsorAuth/schema"
import { modules } from "@/convex/test.setup"
import { insertTestCompetition } from "./testHelpers"
import { seedDirectorUser } from "@/convex/testHelpers"

const sponsorAuthModules = import.meta.glob<string[]>(
  "../auth/component/sponsorAuth/**/!(*.*.*)*.*s"
)

export type SponsorTestHarness = TestConvex<typeof schema>

export function createSponsorTestHarness(): SponsorTestHarness {
  const t = convexTest(schema, modules)
  t.registerComponent("sponsorAuth", sponsorAuthSchema, sponsorAuthModules)
  return t
}

export async function seedSponsorSession(
  t: SponsorTestHarness,
  input?: { email?: string; name?: string; sessionToken?: string }
) {
  const email = input?.email ?? "sponsor@example.com"
  const name = input?.name ?? "Portal Sponsor"
  const sessionToken = input?.sessionToken ?? "sponsor-session-token"
  const ownerId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "owner@example.com" })
  )
  const now = Date.now()
  const sponsorAuthUser = (await t.mutation(
    components.sponsorAuth.adapter.create,
    {
      input: {
        model: "user",
        data: {
          email,
          name,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    }
  )) as { _id: string }
  const sponsorId = await t.run((ctx) =>
    ctx.db.insert("sponsors", {
      name: `${name} Ltd`,
      email,
      emailNormalized: email,
      authUserId: sponsorAuthUser._id,
      active: true,
      createdById: ownerId,
      updatedById: ownerId,
      updatedAt: now,
    })
  )
  await t.mutation(components.sponsorAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        token: sessionToken,
        userId: sponsorAuthUser._id,
        expiresAt: now + 60 * 60 * 1000,
        createdAt: now,
        updatedAt: now,
      },
    },
  })
  return {
    sessionToken,
    sponsorId,
    sponsorAuthUserId: sponsorAuthUser._id,
    ownerId,
  }
}

export async function seedSponsorshipManager(
  t: SponsorTestHarness
): Promise<Id<"users">> {
  return t.run((ctx) => seedDirectorUser(ctx))
}

export type AuctionState = "draft" | "scheduled" | "active" | "closed"

export async function seedSponsorAuctionAccess(
  t: SponsorTestHarness,
  input: { auctionState: AuctionState; sessionToken?: string }
) {
  const { sessionToken, sponsorId, ownerId } = await seedSponsorSession(t, {
    sessionToken: input.sessionToken,
  })
  const now = Date.now()
  const competitionId = await t.run((ctx) =>
    insertTestCompetition(ctx, {
      name: "Snapshot Test Open",
      from: "2026-09-01",
      to: "2026-09-02",
      organisers: [ownerId],
    })
  )
  const auctionId = await t.run((ctx) =>
    ctx.db.insert("sponsorshipAuctions", {
      competitionId,
      framework: "first_sealed",
      state: input.auctionState,
      currency: "EUR",
      startsAt: now - 60_000,
      endsAt: now + 60_000,
      antiSnipingWindowMs: 300_000,
      antiSnipingExtendMs: 300_000,
      startPriceCents: 1_000,
      competitionSnapshot: {
        summary: {
          name: "Snapshot Test Open",
          address: "",
          startDate: "2026-09-01",
          endDate: "2026-09-02",
          eventIds: [],
        },
        source: "competition_record",
        fetchedAt: now,
      },
      createdById: ownerId,
      updatedById: ownerId,
      updatedAt: now,
    })
  )
  await t.run((ctx) =>
    ctx.db.insert("sponsorshipAuctionInvites", {
      auctionId,
      sponsorId,
      invitedById: ownerId,
      invitedAt: now,
    })
  )
  return { auctionId, sessionToken, sponsorId, competitionId }
}

// Vitest requires at least one test per test file.
import { describe, expect, test } from "vitest"
describe("sponsor test harness", () => {
  test("exports helpers for integration tests", () => {
    expect(createSponsorTestHarness).toBeTypeOf("function")
  })
})
