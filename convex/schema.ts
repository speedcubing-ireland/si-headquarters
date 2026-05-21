import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"
import {
  auctionState,
  competitionSponsorPropertyStatus,
  sponsorshipAuctionFramework,
  sponsorshipBidIntentMode,
} from "./sponsorship/lib/validators"
import { competitionSnapshot } from "./sponsorship/lib/competitionSnapshot"

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    image: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  competitions: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    compStart: v.string(),
    compEnd: v.string(),
    compLeadId: v.optional(v.id("users")),
    leadDelegateId: v.optional(v.id("users")),
    organiserIds: v.optional(v.array(v.id("users"))),
    compSheet: v.optional(
      v.object({ type: v.literal("google-sheet"), sheetId: v.string() })
    ),
    wcaCompetitionId: v.optional(v.string()),
    manualSponsorPropertyStatus: v.optional(competitionSponsorPropertyStatus),
    manualSponsorId: v.optional(v.id("sponsors")),
    updatedAt: v.number(),
  })
    .index("by_comp_start", ["compStart"])
    .index("by_name", ["name"])
    .index("by_comp_sheet_id", ["compSheet.sheetId"])
    .index("by_wca_competition_id", ["wcaCompetitionId"]),

  sponsors: defineTable({
    name: v.string(),
    email: v.string(),
    emailNormalized: v.string(),
    avatarUrl: v.optional(v.string()),
    authUserId: v.optional(v.string()),
    lastAccessEmailSentAt: v.optional(v.number()),
    active: v.boolean(),
    createdById: v.id("users"),
    updatedById: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_email_normalized", ["emailNormalized"])
    .index("by_auth_user_id", ["authUserId"])
    .index("by_name", ["name"]),

  sponsorshipAuctions: defineTable({
    competitionId: v.id("competitions"),
    framework: sponsorshipAuctionFramework,
    state: auctionState,
    currency: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    activationScheduledFunctionId: v.optional(v.id("_scheduled_functions")),
    closureScheduledFunctionId: v.optional(v.id("_scheduled_functions")),
    antiSnipingWindowMs: v.number(),
    antiSnipingExtendMs: v.number(),
    startPriceCents: v.number(),
    currentPriceCents: v.optional(v.number()),
    currentLeaderSponsorId: v.optional(v.id("sponsors")),
    currentLeaderMaxCents: v.optional(v.number()),
    winnerSponsorId: v.optional(v.id("sponsors")),
    winningBidId: v.optional(v.id("sponsorshipBidIntents")),
    settlementAmountCents: v.optional(v.number()),
    competitionSnapshot: v.optional(competitionSnapshot),
    readinessSnapshotJson: v.optional(v.string()),
    createdById: v.id("users"),
    updatedById: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_competition", ["competitionId"])
    .index("by_state_and_end", ["state", "endsAt"])
    .index("by_state_and_start", ["state", "startsAt"])
    .index("by_competition_and_state", ["competitionId", "state"]),

  sponsorshipAuctionInvites: defineTable({
    auctionId: v.id("sponsorshipAuctions"),
    sponsorId: v.id("sponsors"),
    invitedById: v.id("users"),
    invitedAt: v.number(),
    inviteSentAt: v.optional(v.number()),
  })
    .index("by_auction", ["auctionId"])
    .index("by_sponsor", ["sponsorId"])
    .index("by_auction_and_sponsor", ["auctionId", "sponsorId"]),

  sponsorshipAuctionReminders: defineTable({
    auctionId: v.id("sponsorshipAuctions"),
    sponsorId: v.id("sponsors"),
    scheduledFor: v.number(),
    sent: v.boolean(),
    sentAt: v.optional(v.number()),
    scheduledFunctionId: v.optional(v.id("_scheduled_functions")),
  })
    .index("by_sent_and_scheduled", ["sent", "scheduledFor"])
    .index("by_auction", ["auctionId"])
    .index("by_auction_and_sponsor", ["auctionId", "sponsorId"]),

  sponsorshipAuctionOutbidNotices: defineTable({
    auctionId: v.id("sponsorshipAuctions"),
    sponsorId: v.id("sponsors"),
    sentAt: v.number(),
  }).index("by_auction_and_sponsor", ["auctionId", "sponsorId"]),

  sponsorshipBidIntents: defineTable({
    auctionId: v.id("sponsorshipAuctions"),
    sponsorId: v.id("sponsors"),
    mode: sponsorshipBidIntentMode,
    amountCents: v.number(),
    maxAmountCents: v.optional(v.number()),
    isValid: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_auction", ["auctionId"])
    .index("by_auction_and_sponsor", ["auctionId", "sponsorId"])
    .index("by_auction_and_created_at", ["auctionId", "createdAt"]),

  sponsorshipBidEvents: defineTable({
    auctionId: v.id("sponsorshipAuctions"),
    sponsorId: v.optional(v.id("sponsors")),
    amountCents: v.number(),
    isAuto: v.boolean(),
    intentId: v.optional(v.id("sponsorshipBidIntents")),
    createdAt: v.number(),
  })
    .index("by_auction", ["auctionId"])
    .index("by_auction_and_created_at", ["auctionId", "createdAt"]),

  sheetScheduleCache: defineTable({
    sheetId: v.string(),
    events: v.array(
      v.object({
        eventName: v.string(),
        rounds: v.string(),
      })
    ),
    fetchedAt: v.number(),
  }).index("by_sheet_id", ["sheetId"]),

  serviceTokens: defineTable({
    service: v.union(v.literal("google"), v.literal("wca"), v.literal("canva")),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    updatedAt: v.number(),
  }).index("by_service", ["service"]),
})
