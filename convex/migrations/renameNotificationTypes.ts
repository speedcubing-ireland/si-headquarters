import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

/**
 * Run once from the Convex dashboard to rename `notificationTypes` to
 * `notificationTypeOverrides` on all competition documents that still have
 * the old field name.
 */
export const renameCompetitionNotificationTypes = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const competitions = await ctx.db
			.query("competitions")
			.withIndex("by_comp_start")
			.order("asc")
			.collect();

		let migrated = 0;
		for (const comp of competitions) {
			const dc = comp.discordChannel;
			if (!dc) continue;

			const hasOldField = "notificationTypes" in dc;
			if (!hasOldField) continue;

			const rawOverrides = (dc as Record<string, unknown>).notificationTypes as
				| string[]
				| undefined;

			const overrides = rawOverrides as
				| NonNullable<
						Doc<"competitions">["discordChannel"]
				  >["notificationTypeOverrides"]
				| undefined;

			await ctx.db.patch("competitions", comp._id, {
				discordChannel: {
					guildId: dc.guildId,
					channelId: dc.channelId,
					channelName: dc.channelName,
					notificationTypeOverrides: overrides,
				},
			});
			migrated++;
		}

		return migrated;
	},
});
