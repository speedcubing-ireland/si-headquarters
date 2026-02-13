import { ConvexError, v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import { sponsorForUI } from "../../lib/sponsorshipValidators";
import { syncSponsorAuthUserProfile } from "../authAccounts";
import { requireSponsorSession } from "./shared";

export const me = query({
	args: {
		sessionToken: v.string(),
	},
	returns: v.union(sponsorForUI, v.null()),
	handler: async (ctx, args) => {
		try {
			const { sponsor } = await requireSponsorSession(ctx, args.sessionToken);
			return {
				id: sponsor._id,
				name: sponsor.name,
				email: sponsor.email,
				avatarUrl: sponsor.avatarUrl,
				active: sponsor.active,
				hasAuthAccount: sponsor.authUserId !== undefined,
				lastAccessEmailSentAt: sponsor.lastAccessEmailSentAt,
			};
		} catch {
			return null;
		}
	},
});

export const updateDisplayName = mutation({
	args: {
		sessionToken: v.string(),
		displayName: v.string(),
	},
	returns: v.object({
		name: v.string(),
	}),
	handler: async (ctx, args) => {
		const { sponsor } = await requireSponsorSession(ctx, args.sessionToken);
		const name = args.displayName.trim();
		if (!name) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Display name cannot be empty.",
			});
		}

		const now = Date.now();
		await ctx.db.patch("sponsors", sponsor._id, {
			name,
			updatedAt: now,
		});

		if (sponsor.authUserId) {
			await syncSponsorAuthUserProfile(ctx, {
				authUserId: sponsor.authUserId,
				name,
				email: sponsor.email,
				avatarUrl: sponsor.avatarUrl,
			});
		}

		return { name };
	},
});
