import { defineTable } from "convex/server"
import { v } from "convex/values"
import { competitionSnapshot } from "@/convex/plugins/sponsor/lib/competitionSnapshot"
import {
  auctionState,
  competitionSponsorOverrideFields,
  sponsorshipAuctionFramework,
  sponsorshipBidIntentMode,
  sponsorshipEmailContext,
  sponsorshipEmailType,
} from "@/convex/plugins/sponsor/lib/validators"

export const sponsorTables = {
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
    .index("by_currentLeaderSponsorId_and_state", [
      "currentLeaderSponsorId",
      "state",
    ])
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

  sponsorshipEmailDispatches: defineTable({
    dedupKey: v.string(),
    emailType: sponsorshipEmailType,
    recipientEmail: v.string(),
    recipientName: v.optional(v.string()),
    cc: v.optional(v.array(v.string())),
    subject: v.string(),
    message: v.string(),
    context: v.optional(sponsorshipEmailContext),
    auctionId: v.optional(v.id("sponsorshipAuctions")),
    sponsorId: v.optional(v.id("sponsors")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("failed")
    ),
    emailId: v.optional(v.string()),
    attempts: v.number(),
    createdAt: v.number(),
    nextAttemptAt: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
    processingStartedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
  })
    .index("by_dedup_key", ["dedupKey"])
    .index("by_status_and_created", ["status", "createdAt"])
    .index("by_status_and_next_attempt", ["status", "nextAttemptAt"])
    .index("by_status_and_processing_started", [
      "status",
      "processingStartedAt",
    ])
    .index("by_auction", ["auctionId"]),

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
    .index("by_auction_and_created_at", ["auctionId", "createdAt"])
    .index("by_sponsor_and_is_valid", ["sponsorId", "isValid"]),

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

  sponsorContacts: defineTable({
    sponsorId: v.id("sponsors"),
    name: v.string(),
    email: v.string(),
    emailNormalized: v.string(),
    authUserId: v.optional(v.string()),
    active: v.boolean(),
    isPrimary: v.boolean(),
    receivesCc: v.boolean(),
    portalAccess: v.boolean(),
    canBid: v.boolean(),
    lastAccessEmailSentAt: v.optional(v.number()),
    createdById: v.id("users"),
    updatedById: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_sponsor", ["sponsorId"])
    .index("by_email_normalized", ["emailNormalized"])
    .index("by_auth_user_id", ["authUserId"]),

  competitionSponsorOverrides: defineTable(competitionSponsorOverrideFields)
    .index("by_competitionId", ["competitionId"])
    .index("by_manualSponsorId", ["manualSponsorId"]),
}
