import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { normalizeEmail, validateEmail } from "../lib/sanitize";
import { sponsorPortalLoginUrl } from "../lib/siteUrls";
import { requireSponsorshipManager } from "../lib/sponsorshipAccess";
import { sponsorForUI } from "../lib/sponsorshipValidators";
import { enqueueSponsorshipEmailBatch } from "./emailQueue";
import {
	ensureSponsorAuthAccount,
	revokeSponsorAuthSessions,
	syncSponsorAuthUserProfile,
} from "./authAccounts";

export const list = query({
	args: {},
	returns: v.array(sponsorForUI),
	handler: async (ctx) => {
		await requireSponsorshipManager(ctx);
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

export const isSponsorshipManagerQuery = query({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		try {
			await requireSponsorshipManager(ctx);
			return true;
		} catch {
			return false;
		}
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
		const actorId = await requireSponsorshipManager(ctx);
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
			avatarUrl: args.avatarUrl?.trim() || undefined,
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
		const actorId = await requireSponsorshipManager(ctx);
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
				: args.avatarUrl?.trim() || undefined;
		if (args.avatarUrl !== undefined) {
			patch.avatarUrl = nextAvatarUrl;
		}

		if (args.active !== undefined) {
			patch.active = args.active;
		}

		await ctx.db.patch("sponsors", sponsor._id, patch);

		if (sponsor.authUserId) {
			await syncSponsorAuthUserProfile(ctx, {
				authUserId: sponsor.authUserId,
				name: nextName,
				email: nextEmail,
				avatarUrl: nextAvatarUrl,
			});
		}

		if (args.active === false && sponsor.active && sponsor.authUserId) {
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
		const actorId = await requireSponsorshipManager(ctx);
		const sponsor = await ctx.db.get("sponsors", args.sponsorId);
		if (!sponsor || !sponsor.active) {
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
		const message =
			"Open the sponsor portal and use a one-time email code for first sign-in, then set a password or passkey.";
		await enqueueSponsorshipEmailBatch(ctx, {
			batchKey: `sponsor_access:${sponsor._id}:${now}`,
			emailType: "invite",
			subject: "Speedcubing Ireland Sponsor Portal access",
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
		await requireSponsorshipManager(ctx);
		const sponsor = await ctx.db.get("sponsors", args.sponsorId);
		if (!sponsor?.authUserId) return null;
		await revokeSponsorAuthSessions(ctx, sponsor.authUserId);
		return null;
	},
});
