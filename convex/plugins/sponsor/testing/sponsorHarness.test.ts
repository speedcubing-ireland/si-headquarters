import { convexTest } from "convex-test"
import type { TestConvex } from "convex-test"
import type {
  DataModelFromSchemaDefinition,
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
} from "convex/server"
import type { GenericId } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import schema from "@/convex/schema"
import sponsorAuthSchema from "@/convex/plugins/sponsor/auth/component/sponsorAuth/schema"
import { modules } from "@/convex/test.setup"
import { insertTestCompetition } from "./testHelpers"
import { seedDirectorUser } from "@/convex/testHelpers"

const sponsorAuthModules = {
  "../auth/component/sponsorAuth/_generated/server.ts": () =>
    import("../auth/component/sponsorAuth/_generated/server"),
  "../auth/component/sponsorAuth/adapter.ts": () =>
    import("./sponsorAuthTestAdapter.testSupport"),
}

export type SponsorTestHarness = TestConvex<typeof schema>
type SponsorAuthDataModel = DataModelFromSchemaDefinition<
  typeof sponsorAuthSchema
>
type SponsorAuthUserId = GenericId<"user">

interface ComponentRunner<DataModel extends GenericDataModel> {
  runInComponent: <Output>(
    componentPath: string,
    func: (
      ctx: GenericMutationCtx<DataModel> &
        Pick<GenericActionCtx<DataModel>, "storage">
    ) => Promise<Output>
  ) => Promise<Output>
}

export function createSponsorTestHarness(): SponsorTestHarness {
  const t = convexTest(schema, modules)
  t.registerComponent("sponsorAuth", sponsorAuthSchema, sponsorAuthModules)
  return t
}

function sponsorAuthRunner(t: SponsorTestHarness) {
  return t as SponsorTestHarness & ComponentRunner<SponsorAuthDataModel>
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
  const sponsorAuthUserId = await sponsorAuthRunner(t).runInComponent(
    "sponsorAuth",
    (ctx) =>
      ctx.db.insert("user", {
        email,
        name,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
  )
  const sponsorId = await t.run(async (ctx) => {
    const sponsorId = await ctx.db.insert("sponsors", {
      name: `${name} Ltd`,
      email,
      emailNormalized: email,
      authUserId: sponsorAuthUserId,
      active: true,
      createdById: ownerId,
      updatedById: ownerId,
      updatedAt: now,
    })
    await ctx.db.insert("sponsorContacts", {
      sponsorId,
      name: `${name} Ltd`,
      email,
      emailNormalized: email,
      authUserId: sponsorAuthUserId,
      active: true,
      isPrimary: true,
      receivesCc: false,
      portalAccess: true,
      canBid: true,
      createdById: ownerId,
      updatedById: ownerId,
      updatedAt: now,
    })
    return sponsorId
  })
  await sponsorAuthRunner(t).runInComponent("sponsorAuth", async (ctx) => {
    await ctx.db.insert("session", {
      token: sessionToken,
      userId: sponsorAuthUserId,
      expiresAt: now + 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now,
    })
  })
  return {
    sessionToken,
    sponsorId,
    sponsorAuthUserId,
    ownerId,
  }
}

export async function getSponsorAuthUser(
  t: SponsorTestHarness,
  authUserId: SponsorAuthUserId
) {
  return await sponsorAuthRunner(t).runInComponent("sponsorAuth", (ctx) =>
    ctx.db.get("user", authUserId)
  )
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

import { describe, expect, test } from "vitest"
describe("sponsor test harness", () => {
  test("exports helpers for integration tests", () => {
    expect(createSponsorTestHarness).toBeTypeOf("function")
  })
})
