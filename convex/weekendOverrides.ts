import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./auth";

const SAT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const weekendOverrideDoc = v.object({
	_id: v.id("weekendOverrides"),
	_creationTime: v.number(),
	satDate: v.string(),
	eventNote: v.optional(v.string()),
	reserved: v.optional(v.boolean()),
	announced: v.optional(v.boolean()),
	updatedAt: v.number(),
});

function isEmpty(
	eventNote: string | undefined,
	reserved: boolean | undefined,
	announced: boolean | undefined,
): boolean {
	const note = eventNote?.trim() ?? "";
	return !note && reserved !== true && announced !== true;
}

function validateSatDate(satDate: string): void {
	if (!SAT_DATE_REGEX.test(satDate)) {
		throw new ConvexError({
			code: "INVALID_SAT_DATE",
			message: "satDate must be YYYY-MM-DD",
		});
	}
}

export const list = query({
	args: {},
	returns: v.array(weekendOverrideDoc),
	handler: async (ctx) => {
		await requireUserId(ctx);
		return await ctx.db
			.query("weekendOverrides")
			.withIndex("by_sat_date")
			.order("asc")
			.collect();
	},
});

export const setOverride = mutation({
	args: {
		satDate: v.string(),
		eventNote: v.optional(v.string()),
		reserved: v.optional(v.boolean()),
		announced: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireUserId(ctx);
		validateSatDate(args.satDate);
		const now = Date.now();
		const existing = await ctx.db
			.query("weekendOverrides")
			.withIndex("by_sat_date", (q) => q.eq("satDate", args.satDate))
			.unique();

		const eventNote =
			args.eventNote !== undefined
				? args.eventNote
				: (existing?.eventNote ?? "");
		const reserved =
			args.reserved !== undefined
				? args.reserved
				: (existing?.reserved ?? false);
		const announced =
			args.announced !== undefined
				? args.announced
				: (existing?.announced ?? false);

		if (isEmpty(eventNote, reserved, announced)) {
			if (existing) {
				await ctx.db.delete("weekendOverrides", existing._id);
			}
			return null;
		}

		const patch = {
			eventNote: eventNote.trim() || undefined,
			reserved,
			announced,
			updatedAt: now,
		};

		if (existing) {
			await ctx.db.patch("weekendOverrides", existing._id, patch);
		} else {
			await ctx.db.insert("weekendOverrides", {
				satDate: args.satDate,
				...patch,
			});
		}
		return null;
	},
});

export const clearAll = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		await requireUserId(ctx);
		const docs = await ctx.db.query("weekendOverrides").collect();
		await Promise.all(
			docs.map((doc) => ctx.db.delete("weekendOverrides", doc._id)),
		);
		return null;
	},
});
