import { v } from "convex/values";
import { mutation } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { isVolunteer, requireUserId } from "../core/auth";
import { canAccessCompetitionResource } from "../lib/permissions/resources";
import { progressUpdateStatus as statusValidator } from "../lib/validators";
import { sendProgressUpdateNotifications } from "../notifications/triggers/competitions";

async function getUpdateAndAssertAuth(
	ctx: MutationCtx,
	updateId: Id<"competitionUpdates">,
	userId: Id<"users">,
	volunteer: boolean,
	action: "edit" | "delete",
): Promise<Doc<"competitionUpdates">> {
	const doc = await ctx.db.get("competitionUpdates", updateId);
	if (!doc) {
		throw new ConvexError({ code: "NOT_FOUND", message: "Update not found" });
	}
	const isAuthor = doc.authorId === userId;
	const canManage = await canAccessCompetitionResource(ctx, {
		userId,
		competitionId: doc.competitionId,
		isVolunteer: volunteer,
	});
	if (!isAuthor && !canManage) {
		const message =
			action === "edit"
				? "Not allowed to edit this update"
				: "Not allowed to delete this update";
		throw new ConvexError({ code: "FORBIDDEN", message });
	}
	return doc;
}

function addUserToReactions(
	reactions: Doc<"competitionUpdates">["reactions"],
	emoji: string,
	userId: Id<"users">,
): Doc<"competitionUpdates">["reactions"] {
	const existing = reactions.find((r) => r.emoji === emoji);
	if (existing) {
		if (existing.userIds.includes(userId)) return reactions;
		return reactions.map((r) =>
			r.emoji === emoji
				? { emoji: r.emoji, userIds: [...r.userIds, userId] }
				: r,
		);
	}
	return [...reactions, { emoji, userIds: [userId] }];
}

export const create = mutation({
	args: {
		competitionId: v.id("competitions"),
		status: statusValidator,
		message: v.optional(v.string()),
	},
	returns: v.id("competitionUpdates"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		const canManage = await canAccessCompetitionResource(ctx, {
			userId,
			competitionId: args.competitionId,
			isVolunteer: volunteer,
		});
		if (!canManage) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Not allowed to post updates for this competition",
			});
		}
		const now = Date.now();
		const id = await ctx.db.insert("competitionUpdates", {
			competitionId: args.competitionId,
			authorId: userId,
			status: args.status,
			message: args.message,
			reactions: [],
			updatedAt: now,
		});
		const competition = await ctx.db.get("competitions", args.competitionId);
		if (competition) {
			await sendProgressUpdateNotifications(ctx, {
				competition,
				competitionId: args.competitionId,
				updateId: id,
				actorId: userId,
				competitionName: competition.name,
				status: args.status,
			});
		}
		return id;
	},
});

export const update = mutation({
	args: {
		updateId: v.id("competitionUpdates"),
		status: v.optional(statusValidator),
		message: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		await getUpdateAndAssertAuth(ctx, args.updateId, userId, volunteer, "edit");
		const hasChanges = args.status !== undefined || args.message !== undefined;
		if (!hasChanges) return null;
		const patch: Partial<Doc<"competitionUpdates">> = {
			updatedAt: Date.now(),
		};
		if (args.status !== undefined) patch.status = args.status;
		if (args.message !== undefined) patch.message = args.message;
		await ctx.db.patch("competitionUpdates", args.updateId, patch);
		return null;
	},
});

export const remove = mutation({
	args: { updateId: v.id("competitionUpdates") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		await getUpdateAndAssertAuth(
			ctx,
			args.updateId,
			userId,
			volunteer,
			"delete",
		);
		await ctx.db.delete("competitionUpdates", args.updateId);
		return null;
	},
});

export const addReaction = mutation({
	args: {
		updateId: v.id("competitionUpdates"),
		emoji: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("competitionUpdates", args.updateId);
		if (!doc) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Update not found",
			});
		}
		const volunteer = await isVolunteer(ctx);
		const canAccess = await canAccessCompetitionResource(ctx, {
			userId,
			competitionId: doc.competitionId,
			isVolunteer: volunteer,
		});
		if (!canAccess) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Not allowed to react to this update",
			});
		}
		const nextReactions = addUserToReactions(doc.reactions, args.emoji, userId);
		await ctx.db.patch("competitionUpdates", args.updateId, {
			reactions: nextReactions,
			updatedAt: Date.now(),
		});
		return null;
	},
});
