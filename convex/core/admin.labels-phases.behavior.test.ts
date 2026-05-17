import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

async function seedDirector(
	t: ReturnType<typeof convexTest>,
): Promise<Id<"users">> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.DIRECTORS,
			memberIds: [userId],
		});
		return userId;
	});
}

describe("labels and phases admin behavior", () => {
	test("create label stores record with name and color", async () => {
		const t = convexTest(schema, modules);
		const directorId = await seedDirector(t);
		const director = t.withIdentity({ subject: directorId });

		const labelId = await director.mutation(api.core.labels.create, {
			name: "Bug",
			color: "#ff0000",
		});

		const doc = await t.run((ctx) => ctx.db.get("labels", labelId));
		expect(doc?.name).toBe("Bug");
		expect(doc?.color).toBe("#ff0000");
		expect(doc?.archived).toBe(false);
	});

	test("update label changes name and color", async () => {
		const t = convexTest(schema, modules);
		const directorId = await seedDirector(t);
		const director = t.withIdentity({ subject: directorId });

		const labelId = await director.mutation(api.core.labels.create, {
			name: "Bug",
			color: "#ff0000",
		});
		await director.mutation(api.core.labels.update, {
			id: labelId,
			name: "Feature",
			color: "#00ff00",
		});

		const doc = await t.run((ctx) => ctx.db.get("labels", labelId));
		expect(doc?.name).toBe("Feature");
		expect(doc?.color).toBe("#00ff00");
	});

	test("delete label removes the record", async () => {
		const t = convexTest(schema, modules);
		const directorId = await seedDirector(t);
		const director = t.withIdentity({ subject: directorId });

		const labelId = await director.mutation(api.core.labels.create, {
			name: "Temp",
			color: "#000",
		});
		await director.mutation(api.core.labels.remove, { id: labelId });

		const doc = await t.run((ctx) => ctx.db.get("labels", labelId));
		expect(doc).toBeNull();
	});

	test("deleteLabelIfUnused rejects deletion when label is used by a task", async () => {
		const t = convexTest(schema, modules);
		const directorId = await seedDirector(t);
		const director = t.withIdentity({ subject: directorId });

		const labelId = await director.mutation(api.core.labels.create, {
			name: "In Use",
			color: "#333",
		});
		await t.run(async (ctx) => {
			const competitionId = await ctx.db.insert("competitions", {
				name: "Comp",
				description: "",
				compStart: "2026-01-01",
				compEnd: "2026-01-02",
				organiserIds: [directorId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("tasks", {
				identifier: "HQ-200",
				title: "Task with label",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				labelIds: [labelId],
				updatedAt: Date.now(),
			});
		});

		await expect(
			director.mutation(api.core.admin.deleteLabelIfUnused, { id: labelId }),
		).rejects.toBeTruthy();
	});

	test("createPhaseAdmin stores phase record", async () => {
		const t = convexTest(schema, modules);
		const directorId = await seedDirector(t);
		const director = t.withIdentity({ subject: directorId });

		const phaseId = await director.mutation(api.core.admin.createPhaseAdmin, {
			key: "planning",
			name: "Planning",
			description: "Initial planning phase",
		});

		const doc = await t.run((ctx) => ctx.db.get("phases", phaseId));
		expect(doc?.key).toBe("planning");
		expect(doc?.name).toBe("Planning");
		expect(doc?.description).toBe("Initial planning phase");
		expect(doc?.archived).toBe(false);
		expect(doc?.order).toBeTypeOf("number");
	});

	test("updatePhaseAdmin changes name, description, archived", async () => {
		const t = convexTest(schema, modules);
		const directorId = await seedDirector(t);
		const director = t.withIdentity({ subject: directorId });

		const phaseId = await director.mutation(api.core.admin.createPhaseAdmin, {
			key: "exec",
			name: "Execution",
			description: "Do the work",
		});
		await director.mutation(api.core.admin.updatePhaseAdmin, {
			id: phaseId,
			name: "Execution v2",
			description: "Updated desc",
			archived: true,
		});

		const doc = await t.run((ctx) => ctx.db.get("phases", phaseId));
		expect(doc?.name).toBe("Execution v2");
		expect(doc?.description).toBe("Updated desc");
		expect(doc?.archived).toBe(true);
	});

	test("deletePhaseIfUnused rejects when phase is used by a task", async () => {
		const t = convexTest(schema, modules);
		const directorId = await seedDirector(t);
		const director = t.withIdentity({ subject: directorId });

		const phaseId = await director.mutation(api.core.admin.createPhaseAdmin, {
			key: "used-phase",
			name: "Used Phase",
			description: "Used by task",
		});
		await t.run(async (ctx) => {
			const competitionId = await ctx.db.insert("competitions", {
				name: "Comp",
				description: "",
				compStart: "2026-01-01",
				compEnd: "2026-01-02",
				organiserIds: [directorId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("tasks", {
				identifier: "HQ-300",
				title: "Task with phase",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				phaseId,
				labelIds: [],
				updatedAt: Date.now(),
			});
		});

		await expect(
			director.mutation(api.core.admin.deletePhaseIfUnused, { id: phaseId }),
		).rejects.toBeTruthy();
	});

	test("deletePhaseIfUnused succeeds for unused phase", async () => {
		const t = convexTest(schema, modules);
		const directorId = await seedDirector(t);
		const director = t.withIdentity({ subject: directorId });

		const phaseId = await director.mutation(api.core.admin.createPhaseAdmin, {
			key: "unused-phase",
			name: "Unused Phase",
			description: "Not used by anything",
		});

		await director.mutation(api.core.admin.deletePhaseIfUnused, {
			id: phaseId,
		});
		const doc = await t.run((ctx) => ctx.db.get("phases", phaseId));
		expect(doc).toBeNull();
	});
});
