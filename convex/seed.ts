import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
	COMPETITION_PHASE_KEYS,
	DEFAULT_LABELS,
	DEFAULT_PHASES,
	SEEDED_TEAM_NAMES,
} from "../src/data/types-new";

/**
 * Seed core teams, task labels, and global phases.
 */
export const seedInitialData = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		// Seed teams (idempotent by name)
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

		// Seed labels from DEFAULT_LABELS (idempotent by name)
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

		// Seed global phases using DEFAULT_PHASES and COMPETITION_PHASE_KEYS.
		// This powers competition phases and task phase assignments via ids.
		const existingPhases = await ctx.db.query("phases").collect();
		if (existingPhases.length === 0) {
			for (const [index, phaseTemplate] of DEFAULT_PHASES.entries()) {
				const key =
					COMPETITION_PHASE_KEYS[index] ??
					phaseTemplate.name.toLowerCase().replace(/\s+/g, "-");

				// Idempotent by key.
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
