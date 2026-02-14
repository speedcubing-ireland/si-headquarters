import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
	requireUserId,
	ensureUserInVolunteerTeam,
	applyPendingTeamMemberships,
} from "./auth";
import { buildDefaultAvatarUrl } from "./lib/defaultAvatar";

const userDocValidator = v.union(
	v.null(),
	v.object({
		_id: v.id("users"),
		_creationTime: v.number(),
		name: v.optional(v.string()),
		image: v.optional(v.string()),
		email: v.optional(v.string()),
	}),
);

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_CONTENT_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif",
	"image/avif",
]);
const MAX_NAME_LENGTH = 80;

function sanitizeName(name: string): string {
	const nextName = name.trim();
	if (!nextName) {
		throw new ConvexError("Name cannot be empty.");
	}
	if (nextName.length > MAX_NAME_LENGTH) {
		throw new ConvexError("Name is too long.");
	}
	return nextName;
}

export const appUserShape = v.object({
	id: v.id("users"),
	name: v.string(),
	avatarUrl: v.string(),
});

export const getCurrentUser = query({
	args: {},
	returns: userDocValidator,
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (userId === null) return null;
		const user = await ctx.db.get("users", userId);
		if (!user) return null;
		return {
			_id: user._id,
			_creationTime: user._creationTime,
			name: user.name,
			image: user.image,
			email: user.email,
		};
	},
});

export const listUsers = query({
	args: {},
	returns: v.array(appUserShape),
	handler: async (ctx) => {
		await requireUserId(ctx);
		const users = await ctx.db.query("users").withIndex("email").collect();
		return users.map((u) => ({
			id: u._id,
			name: u.name ?? "",
			avatarUrl: u.image ?? "",
		}));
	},
});

export const ensureVolunteerAccess = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		await ensureUserInVolunteerTeam(ctx, userId);
		await applyPendingTeamMemberships(ctx, userId);
		return null;
	},
});

export const updateCurrentUserName = mutation({
	args: {
		name: v.string(),
	},
	returns: v.string(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const nextName = sanitizeName(args.name);
		await ctx.db.patch(userId, { name: nextName });
		return nextName;
	},
});

export const generateAvatarUploadUrl = mutation({
	args: {},
	returns: v.string(),
	handler: async (ctx) => {
		await requireUserId(ctx);
		return await ctx.storage.generateUploadUrl();
	},
});

export const setCurrentUserAvatarFromStorage = mutation({
	args: {
		storageId: v.id("_storage"),
	},
	returns: v.string(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const file = await ctx.db.system.get("_storage", args.storageId);
		if (!file) {
			throw new ConvexError("Uploaded avatar not found.");
		}
		const contentType = file.contentType ?? "";
		const isAllowedType = ALLOWED_AVATAR_CONTENT_TYPES.has(contentType);
		const isAllowedSize = file.size <= MAX_AVATAR_SIZE_BYTES;
		if (!isAllowedType || !isAllowedSize) {
			await ctx.storage.delete(args.storageId);
			throw new ConvexError(
				"Avatar must be PNG, JPEG, WebP, GIF, or AVIF and up to 5MB.",
			);
		}
		const avatarUrl = await ctx.storage.getUrl(args.storageId);
		if (!avatarUrl) {
			throw new ConvexError("Unable to read uploaded avatar.");
		}
		await ctx.db.patch(userId, { image: avatarUrl });
		return avatarUrl;
	},
});

export const rerollCurrentUserAvatar = mutation({
	args: {},
	returns: v.string(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const avatarUrl = buildDefaultAvatarUrl(`${userId}-${Date.now()}`);
		await ctx.db.patch(userId, { image: avatarUrl });
		return avatarUrl;
	},
});
