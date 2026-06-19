import { describe, expect, test } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import { sendEbayAuctionOutbidEmail } from "./emails"
import { insertTestCompetition } from "@/convex/plugins/sponsor/testing/testHelpers"
import {
  createSponsorAuctionTestHarness,
  type SponsorAuctionTestHarness,
} from "@/convex/plugins/sponsor/testing/auctionTestHarness.testSupport"

async function seedProxyAuction(t: SponsorAuctionTestHarness): Promise<{
  competitionId: Id<"competitions">
  auctionId: Id<"sponsorshipAuctions">
  sponsorAId: Id<"sponsors">
  sponsorBId: Id<"sponsors">
}> {
  return t.run(async (ctx) => {
    const managerId = await ctx.db.insert("users", {})
    const competitionId = await insertTestCompetition(ctx, {
      name: "Irish Open 2026",
      from: "2026-09-01",
      to: "2026-09-02",
      organisers: [managerId],
    })
    const sponsorAId = await ctx.db.insert("sponsors", {
      name: "Sponsor A",
      email: "a@example.com",
      emailNormalized: "a@example.com",
      active: true,
      createdById: managerId,
      updatedById: managerId,
      updatedAt: Date.now(),
    })
    const sponsorBId = await ctx.db.insert("sponsors", {
      name: "Sponsor B",
      email: "b@example.com",
      emailNormalized: "b@example.com",
      active: true,
      createdById: managerId,
      updatedById: managerId,
      updatedAt: Date.now(),
    })
    const now = Date.now()
    const auctionId = await ctx.db.insert("sponsorshipAuctions", {
      competitionId,
      framework: "ebay_proxy",
      state: "active",
      currency: "EUR",
      startsAt: now - 60_000,
      endsAt: now + 3_600_000,
      antiSnipingWindowMs: 300_000,
      antiSnipingExtendMs: 300_000,
      startPriceCents: 10_000,
      createdById: managerId,
      updatedById: managerId,
      updatedAt: now,
    })
    for (const sponsorId of [sponsorAId, sponsorBId]) {
      await ctx.db.insert("sponsorshipAuctionInvites", {
        auctionId,
        sponsorId,
        invitedById: managerId,
        invitedAt: now,
      })
    }
    return { competitionId, auctionId, sponsorAId, sponsorBId }
  })
}

async function getOutbidScheduledEmails(
  t: SponsorAuctionTestHarness
): Promise<{ emailType: string; sponsorId?: string; context: unknown }[]> {
  return t.run(async (ctx) => {
    const all = await ctx.db.query("sponsorshipEmailDispatches").collect()
    return all
      .filter((dispatch) => dispatch.emailType === "auction_ebay_outbid")
      .map((dispatch) => ({
        emailType: dispatch.emailType,
        sponsorId: dispatch.sponsorId,
        context: dispatch.context,
      }))
  })
}

describe("sendEbayAuctionOutbidEmail", () => {
  test("first send with no prior throttle record enqueues email", async () => {
    const t = createSponsorAuctionTestHarness()
    const { auctionId, sponsorAId } = await seedProxyAuction(t)

    await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      if (!auction) throw new Error("auction not found")
      await sendEbayAuctionOutbidEmail(ctx, auction, sponsorAId)
    })

    const emails = await getOutbidScheduledEmails(t)
    expect(emails).toHaveLength(1)
    expect(emails[0].emailType).toBe("auction_ebay_outbid")
  })

  test("outbid by manual bid — enqueues exactly one auction_ebay_outbid to displaced sponsor", async () => {
    const t = createSponsorAuctionTestHarness()
    const { auctionId, sponsorAId } = await seedProxyAuction(t)

    await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      if (!auction) throw new Error("auction not found")
      await sendEbayAuctionOutbidEmail(ctx, auction, sponsorAId)
    })

    const emails = await getOutbidScheduledEmails(t)
    expect(emails).toHaveLength(1)
    expect(emails[0].sponsorId).toBe(sponsorAId)
  })

  test("throttle window — second outbid within 10 min does not enqueue another email", async () => {
    const t = createSponsorAuctionTestHarness()
    const { auctionId, sponsorAId } = await seedProxyAuction(t)

    await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      if (!auction) throw new Error("auction not found")
      await sendEbayAuctionOutbidEmail(ctx, auction, sponsorAId)
      await sendEbayAuctionOutbidEmail(ctx, auction, sponsorAId)
    })

    const emails = await getOutbidScheduledEmails(t)
    expect(emails).toHaveLength(1)
  })

  test("throttle release — second outbid after 11 min enqueues a second email", async () => {
    const t = createSponsorAuctionTestHarness()
    const { auctionId, sponsorAId } = await seedProxyAuction(t)

    await t.run(async (ctx) => {
      await ctx.db.insert("sponsorshipAuctionOutbidNotices", {
        auctionId,
        sponsorId: sponsorAId,
        sentAt: Date.now() - 11 * 60 * 1000,
      })
    })

    await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      if (!auction) throw new Error("auction not found")
      await sendEbayAuctionOutbidEmail(ctx, auction, sponsorAId)
    })

    const emails = await getOutbidScheduledEmails(t)
    expect(emails).toHaveLength(1)
  })

  test("throttle is per (auction, sponsor) — different sponsor still gets email", async () => {
    const t = createSponsorAuctionTestHarness()
    const { auctionId, sponsorAId, sponsorBId } = await seedProxyAuction(t)

    await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      if (!auction) throw new Error("auction not found")
      await sendEbayAuctionOutbidEmail(ctx, auction, sponsorAId)
      await sendEbayAuctionOutbidEmail(ctx, auction, sponsorBId)
    })

    const emails = await getOutbidScheduledEmails(t)
    expect(emails).toHaveLength(2)
    const recipientIds = emails.map((e) => e.sponsorId)
    expect(recipientIds).toContain(sponsorAId)
    expect(recipientIds).toContain(sponsorBId)
  })

  test("sealed auction framework — no email sent", async () => {
    const t = createSponsorAuctionTestHarness()
    const { auctionId, sponsorAId } = await seedProxyAuction(t)

    await t.run(async (ctx) => {
      await ctx.db.patch("sponsorshipAuctions", auctionId, {
        framework: "first_sealed",
      })
    })

    await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      if (!auction) throw new Error("auction not found")
      await sendEbayAuctionOutbidEmail(ctx, auction, sponsorAId)
    })

    const emails = await getOutbidScheduledEmails(t)
    expect(emails).toHaveLength(0)
  })

  test("inactive sponsor — no email sent", async () => {
    const t = createSponsorAuctionTestHarness()
    const { auctionId, sponsorAId } = await seedProxyAuction(t)

    await t.run(async (ctx) => {
      await ctx.db.patch("sponsors", sponsorAId, { active: false })
    })

    await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      if (!auction) throw new Error("auction not found")
      await sendEbayAuctionOutbidEmail(ctx, auction, sponsorAId)
    })

    const emails = await getOutbidScheduledEmails(t)
    expect(emails).toHaveLength(0)
  })

  test("anti-sniping extension propagated — email context.endsAt reflects extended value", async () => {
    const t = createSponsorAuctionTestHarness()
    const { auctionId, sponsorAId } = await seedProxyAuction(t)

    const extendedEndsAt = Date.now() + 7_200_000

    await t.run(async (ctx) => {
      await ctx.db.patch("sponsorshipAuctions", auctionId, {
        endsAt: extendedEndsAt,
      })
    })

    await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      if (!auction) throw new Error("auction not found")
      await sendEbayAuctionOutbidEmail(ctx, auction, sponsorAId)
    })

    const emails = await getOutbidScheduledEmails(t)
    expect(emails).toHaveLength(1)
    const context = emails[0].context as { endsAt: number }
    expect(context.endsAt).toBe(extendedEndsAt)
  })

  test("email subject contains competition name", async () => {
    const t = createSponsorAuctionTestHarness()
    const { auctionId, sponsorAId } = await seedProxyAuction(t)

    await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      if (!auction) throw new Error("auction not found")
      await sendEbayAuctionOutbidEmail(ctx, auction, sponsorAId)
    })

    await t.run(async (ctx) => {
      const all = await ctx.db.query("sponsorshipEmailDispatches").collect()
      const dispatch = all.find(
        (row) => row.emailType === "auction_ebay_outbid"
      )
      expect(dispatch).toBeDefined()
      if (dispatch === undefined) {
        throw new Error("expected auction_ebay_outbid dispatch")
      }
      expect(dispatch.subject).toContain("Irish Open 2026")
      expect(dispatch.subject).toContain("outbid")
    })
  })
})
