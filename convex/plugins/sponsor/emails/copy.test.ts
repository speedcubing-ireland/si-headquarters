import { describe, expect, test } from "vitest"
import { auctionFrameworkLabel } from "@/convex/plugins/sponsor/lib/types"
import {
  getSponsorshipEmailPayload,
  sponsorshipEmailMessageFallback,
  sponsorshipEmailSubject,
  sponsorshipEmailTemplateCopy,
  sponsorOtpAuthEmailSubject,
  sponsorOtpPurposeFromAuthType,
} from "./copy"
import { formatMoney } from "./_design"
import { organisationConfig } from "@/config/lib/organisation"

describe("auctionFrameworkLabel", () => {
  test("returns brief framework titles", () => {
    expect(auctionFrameworkLabel("first_sealed")).toBe("Sealed Bid")
    expect(auctionFrameworkLabel("vickrey")).toBe("Vickrey Auction")
    expect(auctionFrameworkLabel("ebay_proxy")).toBe("Proxy Bidding")
  })
})

describe("formatMoney", () => {
  test("formats cents as currency", () => {
    expect(formatMoney(125_000)).toBe(
      `${organisationConfig.sponsorship.defaultCurrency} 1250.00`
    )
    expect(formatMoney(10_000, "USD")).toBe("USD 100.00")
  })
})

describe("sponsorshipEmailSubject", () => {
  const ctx = { competitionName: "Irish Open 2026" }

  test("uses competition name in auction subjects", () => {
    expect(sponsorshipEmailSubject("auction_scheduled", ctx)).toBe(
      "Irish Open 2026: bidding opening soon"
    )
    expect(sponsorshipEmailSubject("auction_ebay_outbid", ctx)).toBe(
      "Irish Open 2026: you have been outbid"
    )
  })
})

describe("getSponsorshipEmailPayload", () => {
  test("matches subject and fallback for outbid", () => {
    const payload = getSponsorshipEmailPayload("auction_ebay_outbid", {
      competitionName: "Irish Open 2026",
    })
    expect(payload.subject).toBe("Irish Open 2026: you have been outbid")
    expect(payload.message).toContain("outbid")
  })

  test("formats winner fallback with settlement amount", () => {
    const payload = getSponsorshipEmailPayload("auction_closed_winner", {
      competitionName: "Irish Open 2026",
      settlementAmountCents: 125_000,
    })
    expect(payload.message).toContain(
      `${organisationConfig.sponsorship.defaultCurrency} 1250.00`
    )
    expect(payload.message).toContain(
      organisationConfig.contacts.sponsorshipTeamName
    )
    expect(payload.message).not.toContain("Finance will follow up")
  })
})

describe("sponsorshipEmailTemplateCopy", () => {
  test("scheduled email title has no double colon", () => {
    const copy = sponsorshipEmailTemplateCopy("auction_scheduled", {
      competitionName: "Irish Open 2026",
    })
    expect(copy.title).toBe("Irish Open 2026: bidding opening soon")
    expect(copy.title).not.toContain(": :")
  })

  test("active reminder includes anti-sniping flag", () => {
    const copy = sponsorshipEmailTemplateCopy("auction_active_reminder", {
      competitionName: "Irish Open 2026",
      endsAt: Date.UTC(2026, 8, 1, 12, 0),
      sponsorHasBid: true,
    })
    expect(copy.showAntiSnipingNote).toBe(true)
    expect(copy.bodyParagraphs[0]).toContain("bid in place")
  })
})

describe("sponsorOtpAuthEmailSubject", () => {
  test("maps auth types to subjects", () => {
    expect(sponsorOtpAuthEmailSubject("sign-in")).toContain("sign-in code")
    expect(sponsorOtpPurposeFromAuthType("email-verification")).toBe(
      "verify your email"
    )
  })
})

describe("sponsorshipEmailMessageFallback", () => {
  test("invite fallback mentions portal sign-in", () => {
    expect(sponsorshipEmailMessageFallback("invite", {})).toContain(
      "one-time email code"
    )
  })
})
