import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api, internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  createSponsorTestHarness,
  seedSponsorAuctionAccess,
  seedSponsorshipManager,
} from "@/convex/plugins/sponsor/testing/sponsorHarness.test"
import { seedDirectorUser } from "@/convex/testHelpers"

describe("sponsor contacts behavior", () => {
  test("create sponsor inserts a primary contact with default permissions", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    const sponsorId = await manager.mutation(
      api.plugins.sponsor.admin.sponsors.create,
      {
        name: "Acme Corp",
        email: "primary@example.com",
      }
    )

    const contacts = await t.run((ctx) =>
      ctx.db
        .query("sponsorContacts")
        .withIndex("by_sponsor", (q) => q.eq("sponsorId", sponsorId))
        .collect()
    )
    expect(contacts).toHaveLength(1)
    expect(contacts[0]?.isPrimary).toBe(true)
    expect(contacts[0]?.portalAccess).toBe(true)
    expect(contacts[0]?.canBid).toBe(true)
    expect(contacts[0]?.receivesCc).toBe(false)
  })

  test("create contact rejects duplicate normalized email", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    const sponsorId = await manager.mutation(
      api.plugins.sponsor.admin.sponsors.create,
      {
        name: "Acme Corp",
        email: "owner@example.com",
      }
    )

    await manager.mutation(api.plugins.sponsor.admin.contacts.create, {
      sponsorId,
      name: "CC Person",
      email: "cc@example.com",
    })

    await expect(
      manager.mutation(api.plugins.sponsor.admin.contacts.create, {
        sponsorId,
        name: "Duplicate",
        email: "CC@example.com",
      })
    ).rejects.toBeTruthy()
  })

  test("create contact rejects another sponsor's primary email", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    const sponsorId = await manager.mutation(
      api.plugins.sponsor.admin.sponsors.create,
      {
        name: "Acme Corp",
        email: "owner@example.com",
      }
    )
    await manager.mutation(api.plugins.sponsor.admin.sponsors.create, {
      name: "Other Corp",
      email: "other@example.com",
    })

    await expect(
      manager.mutation(api.plugins.sponsor.admin.contacts.create, {
        sponsorId,
        name: "Duplicate",
        email: "OTHER@example.com",
      })
    ).rejects.toBeTruthy()
  })

  test("sponsor update keeps the primary contact in sync", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    const sponsorId = await manager.mutation(
      api.plugins.sponsor.admin.sponsors.create,
      {
        name: "Acme Corp",
        email: "owner@example.com",
      }
    )

    await manager.mutation(api.plugins.sponsor.admin.sponsors.update, {
      sponsorId,
      name: "Acme Ireland",
      email: "primary@example.com",
    })

    const contact = await t.run((ctx) =>
      ctx.db
        .query("sponsorContacts")
        .withIndex("by_sponsor", (q) => q.eq("sponsorId", sponsorId))
        .unique()
    )
    expect(contact?.name).toBe("Acme Ireland")
    expect(contact?.emailNormalized).toBe("primary@example.com")
    expect(contact?.isPrimary).toBe(true)
  })

  test("primary contact cannot be archived directly", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    const sponsorId = await manager.mutation(
      api.plugins.sponsor.admin.sponsors.create,
      {
        name: "Acme Corp",
        email: "owner@example.com",
      }
    )
    const contact = await t.run((ctx) =>
      ctx.db
        .query("sponsorContacts")
        .withIndex("by_sponsor", (q) => q.eq("sponsorId", sponsorId))
        .unique()
    )
    if (!contact) throw new Error("missing primary contact")

    await expect(
      manager.mutation(api.plugins.sponsor.admin.contacts.update, {
        contactId: contact._id,
        active: false,
      })
    ).rejects.toBeTruthy()
  })

  test("backfill creates primary contacts for legacy sponsors", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const now = Date.now()
    const sponsorId = await t.run((ctx) =>
      ctx.db.insert("sponsors", {
        name: "Legacy Sponsor",
        email: "legacy@example.com",
        emailNormalized: "legacy@example.com",
        authUserId: "legacy-auth-user",
        active: true,
        createdById: managerId,
        updatedById: managerId,
        updatedAt: now,
      })
    )

    const result = await t.mutation(
      internal.plugins.sponsor.admin.contactsBackfill.backfillPrimaryContacts,
      {}
    )
    expect(result.created).toBe(1)

    const contact = await t.run((ctx) =>
      ctx.db
        .query("sponsorContacts")
        .withIndex("by_sponsor", (q) => q.eq("sponsorId", sponsorId))
        .unique()
    )
    expect(contact?.isPrimary).toBe(true)
    expect(contact?.authUserId).toBe("legacy-auth-user")
    expect(contact?.portalAccess).toBe(true)
    expect(contact?.canBid).toBe(true)
    expect(contact?.receivesCc).toBe(false)
  })

  test("non-bidding contact cannot place bids on invited auction", async () => {
    const harness = createSponsorTestHarness()
    const { sessionToken, sponsorId, auctionId } =
      await seedSponsorAuctionAccess(harness, {
        auctionState: "active",
        sessionToken: "viewer-session",
      })

    await harness.run(async (ctx) => {
      const contacts = await ctx.db
        .query("sponsorContacts")
        .withIndex("by_sponsor", (q) => q.eq("sponsorId", sponsorId))
        .collect()
      const primary = contacts.find((row) => row.isPrimary)
      if (!primary) throw new Error("missing primary")
      await ctx.db.patch("sponsorContacts", primary._id, { canBid: false })
    })

    await expect(
      harness.mutation(api.plugins.sponsor.portal.auctions.placeBid, {
        sessionToken,
        auctionId,
        amountCents: 1_500,
      })
    ).rejects.toBeTruthy()

    const auction = await harness.query(
      api.plugins.sponsor.portal.auctions.getAuction,
      { sessionToken, auctionId }
    )
    expect(auction?.canBid).toBe(false)
  })

  test("revoke contact sessions clears sponsor auth sessions", async () => {
    const harness = createSponsorTestHarness()
    const managerId = await seedSponsorshipManager(harness)
    const manager = harness.withIdentity({ subject: managerId })
    const { sessionToken, sponsorId } = await seedSponsorAuctionAccess(
      harness,
      {
        auctionState: "active",
      }
    )

    const contactId = await harness.run(async (ctx) => {
      const primary = await ctx.db
        .query("sponsorContacts")
        .withIndex("by_sponsor", (q) => q.eq("sponsorId", sponsorId))
        .collect()
        .then((rows) => rows.find((row) => row.isPrimary))
      if (!primary) throw new Error("missing primary")
      return primary._id
    })

    await manager.mutation(api.plugins.sponsor.admin.contacts.revokeSessions, {
      contactId,
    })

    await expect(
      harness.query(api.plugins.sponsor.portal.auctions.listAuctions, {
        sessionToken,
      })
    ).rejects.toBeTruthy()
  })
})
