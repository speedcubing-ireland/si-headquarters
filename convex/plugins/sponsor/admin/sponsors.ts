import { ConvexError, v } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel";
import { mutation, query, type MutationCtx } from "@/convex/_generated/server";
import { requireSponsorPortalAdmin } from "@/convex/permissions/principal"
import { resolveAuctionBidState } from "../lib/auctionState"
import { normalizeEmail, validateEmail } from "@/convex/plugins/sponsor/sanitize"
import { sponsorPortalLoginUrl } from "@/convex/plugins/sponsor/siteUrls"
import { sponsorForUI } from "@/convex/plugins/sponsor/lib/validators"
import { getSponsorshipEmailPayload } from "../emails/copy"
import { scheduleSponsorshipEmailBatch } from "../emails/send"
import {
  ensureSponsorAuthAccount,
  revokeSponsorAuthSessions,
  syncSponsorAuthUserProfile,
} from "../auth/accounts"

function normalizeOptionalUrl(
	value: string | null | undefined,
): string | undefined {
	if (value === null) {
		return undefined;
	}
	const trimmed = value?.trim();
	if (trimmed === undefined || trimmed.length === 0) {
		return undefined;
	}
	return trimmed;
}

async function archiveSponsorFromOpenAuctions(
	ctx: MutationCtx,
	args: {
		actorId: Id<"users">;
		sponsorId: Id<"sponsors">;
	},
): Promise<void> {
	const openAuctions = await ctx.db.query("sponsorshipAuctions").collect();
	for (const auction of openAuctions) {
		if (auction.state === "closed") continue;

		const sponsorIntents = await ctx.db
			.query("sponsorshipBidIntents")
			.withIndex("by_auction_and_sponsor", (q) =>
				q.eq("auctionId", auction._id).eq("sponsorId", args.sponsorId),
			)
			.collect();
		const validSponsorIntents = sponsorIntents.filter(
			(intent) => intent.isValid,
		);
		if (
			validSponsorIntents.length === 0 &&
			auction.currentLeaderSponsorId !== args.sponsorId
		) {
			continue;
		}

		await Promise.all(
			validSponsorIntents.map((intent) =>
				ctx.db.patch("sponsorshipBidIntents", intent._id, {
					isValid: false,
				}),
			),
		);

		const allAuctionIntents = await ctx.db
			.query("sponsorshipBidIntents")
			.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
			.collect();
		const validIntents = allAuctionIntents.filter(
			(intent) => intent.isValid && intent.sponsorId !== args.sponsorId,
		);
		await ctx.db.patch("sponsorshipAuctions", auction._id, {
			...resolveAuctionBidState({
				auction,
				validIntents,
			}),
			updatedById: args.actorId,
			updatedAt: Date.now(),
		});
	}
}

export const list = query({
	args: {},
	returns: v.array(sponsorForUI),
	handler: async (ctx) => {
		await requireSponsorPortalAdmin(ctx);
		const sponsors = await ctx.db
			.query("sponsors")
			.withIndex("by_name")
			.order("asc")
			.collect();
		return sponsors.map((sponsor) => ({
			id: sponsor._id,
			name: sponsor.name,
			email: sponsor.email,
			avatarUrl: sponsor.avatarUrl,
			active: sponsor.active,
			hasAuthAccount: sponsor.authUserId !== undefined,
			lastAccessEmailSentAt: sponsor.lastAccessEmailSentAt,
		}));
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		email: v.string(),
		avatarUrl: v.optional(v.string()),
	},
	returns: v.id("sponsors"),
	handler: async (ctx, args) => {
		const actorId = await requireSponsorPortalAdmin(ctx);
		const emailNormalized = normalizeEmail(args.email);
		if (!emailNormalized || !validateEmail(emailNormalized)) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "A valid email address is required.",
			});
		}
		const name = args.name.trim();
		if (!name) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Sponsor name is required.",
			});
		}

		const existing = await ctx.db
			.query("sponsors")
			.withIndex("by_email_normalized", (q) =>
				q.eq("emailNormalized", emailNormalized),
			)
			.unique();
		if (existing) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "A sponsor already exists for this email.",
			});
		}

		const now = Date.now();
		return await ctx.db.insert("sponsors", {
			name,
			email: emailNormalized,
			emailNormalized,
			avatarUrl: normalizeOptionalUrl(args.avatarUrl),
			active: true,
			createdById: actorId,
			updatedById: actorId,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		sponsorId: v.id("sponsors"),
		name: v.optional(v.string()),
		email: v.optional(v.string()),
		avatarUrl: v.optional(v.union(v.string(), v.null())),
		active: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const actorId = await requireSponsorPortalAdmin(ctx);
		const sponsor = await ctx.db.get("sponsors", args.sponsorId);
		if (!sponsor) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Sponsor not found.",
			});
		}

		const patch: Partial<typeof sponsor> = {
			updatedById: actorId,
			updatedAt: Date.now(),
		};
		if (sponsor.email !== sponsor.emailNormalized) {
			patch.email = sponsor.emailNormalized;
			patch.emailNormalized = sponsor.emailNormalized;
		}
		const nextName = args.name === undefined ? sponsor.name : args.name.trim();
		if (!nextName) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Sponsor name cannot be empty.",
			});
		}
		if (args.name !== undefined) {
			patch.name = nextName;
		}

		let nextEmail = sponsor.emailNormalized;
		if (args.email !== undefined) {
			const emailNormalized = normalizeEmail(args.email.trim());
			if (!emailNormalized || !validateEmail(emailNormalized)) {
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: "A valid email address is required.",
				});
			}
			const existing = await ctx.db
				.query("sponsors")
				.withIndex("by_email_normalized", (q) =>
					q.eq("emailNormalized", emailNormalized),
				)
				.unique();
			if (existing && existing._id !== sponsor._id) {
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: "Another sponsor already uses that email.",
				});
			}
			nextEmail = emailNormalized;
			patch.email = nextEmail;
			patch.emailNormalized = emailNormalized;
		}

		const nextAvatarUrl =
			args.avatarUrl === undefined
				? sponsor.avatarUrl
				: normalizeOptionalUrl(args.avatarUrl);
		if (args.avatarUrl !== undefined) {
			patch.avatarUrl = nextAvatarUrl;
		}

		if (args.active !== undefined) {
			patch.active = args.active;
		}

		if (args.active === false && sponsor.active) {
			await archiveSponsorFromOpenAuctions(ctx, {
				sponsorId: sponsor._id,
				actorId,
			});
		}

		await ctx.db.patch("sponsors", sponsor._id, patch);

		if (sponsor.authUserId !== undefined) {
			await syncSponsorAuthUserProfile(ctx, {
				authUserId: sponsor.authUserId,
				name: nextName,
				email: nextEmail,
				avatarUrl: nextAvatarUrl,
			});
		}

		if (args.active === false && sponsor.active && sponsor.authUserId !== undefined) {
			await revokeSponsorAuthSessions(ctx, sponsor.authUserId);
		}
		return null;
	},
});

export const sendAccessEmail = mutation({
	args: {
		sponsorId: v.id("sponsors"),
	},
	returns: v.object({
		sentTo: v.string(),
		hasAuthAccount: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const actorId = await requireSponsorPortalAdmin(ctx);
		const sponsor = await ctx.db.get("sponsors", args.sponsorId);
		if (sponsor?.active !== true) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Active sponsor not found.",
			});
		}

		await ensureSponsorAuthAccount(ctx, {
			sponsor,
			updatedById: actorId,
		});
		const refreshedSponsor = await ctx.db.get("sponsors", sponsor._id);
		const sponsorEmail = refreshedSponsor?.email ?? sponsor.email;
		const now = Date.now();
		const portalUrl = sponsorPortalLoginUrl();
		const { subject, message } = getSponsorshipEmailPayload("invite", {
			sponsorName: sponsor.name,
		});
		await scheduleSponsorshipEmailBatch(ctx, {
			emailType: "invite",
			subject,
			message,
			context: {
				portalUrl,
			},
			recipients: [
				{
					sponsorId: sponsor._id,
					email: sponsorEmail,
					name: sponsor.name,
				},
			],
		});

		await ctx.db.patch("sponsors", sponsor._id, {
			lastAccessEmailSentAt: now,
			updatedById: actorId,
			updatedAt: now,
		});

		return {
			sentTo: sponsorEmail,
			hasAuthAccount: true,
		};
	},
});

export const revokeSessions = mutation({
	args: { sponsorId: v.id("sponsors") },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireSponsorPortalAdmin(ctx);
		const sponsor = await ctx.db.get("sponsors", args.sponsorId);
		if (sponsor?.authUserId === undefined) return null;
		await revokeSponsorAuthSessions(ctx, sponsor.authUserId);
		return null;
	},
});
