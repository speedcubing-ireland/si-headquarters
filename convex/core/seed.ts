import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import {
	COMPETITION_PHASE_KEYS,
	DEFAULT_LABELS,
	DEFAULT_PHASES,
	SEEDED_TEAM_NAMES,
} from "../lib/seedData";
export const seedInitialData = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		for (const name of SEEDED_TEAM_NAMES) {
			const existing = await ctx.db
				.query("teams")
				.withIndex("by_name", (q) => q.eq("name", name))
				.unique();

			if (!existing) {
				await ctx.db.insert("teams", {
					name,
					memberIds: [],
				});
			}
		}

		for (const label of DEFAULT_LABELS) {
			const existing = await ctx.db
				.query("labels")
				.withIndex("by_name", (q) => q.eq("name", label.name))
				.unique();

			if (!existing) {
				await ctx.db.insert("labels", {
					name: label.name,
					color: label.color,
					archived: false,
				});
			}
		}

		const existingPhases = await ctx.db
			.query("phases")
			.withIndex("by_order")
			.collect();
		if (existingPhases.length === 0) {
			for (const [index, phaseTemplate] of DEFAULT_PHASES.entries()) {
				const key =
					COMPETITION_PHASE_KEYS[index] ??
					phaseTemplate.name.toLowerCase().replace(/\s+/g, "-");

				const existing = await ctx.db
					.query("phases")
					.withIndex("by_order", (q) => q.eq("order", index))
					.collect();

				if (existing.some((p) => p.key === key)) continue;

				await ctx.db.insert("phases", {
					key,
					name: phaseTemplate.name,
					description: phaseTemplate.description,
					order: index,
					archived: false,
				});
			}
		}

		return null;
	},
});
