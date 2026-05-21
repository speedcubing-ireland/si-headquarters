import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

async function seedDirectorAndVolunteer(
	t: ReturnType<typeof convexTest>,
): Promise<{
	directorId: Id<"users">;
	volunteerId: Id<"users">;
}> {
	return t.run(async (ctx) => {
		const directorId = await ctx.db.insert("users", {});
		const volunteerId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.DIRECTORS,
			memberIds: [directorId],
		});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [directorId, volunteerId],
		});
		return { directorId, volunteerId };
	});
}

describe("competitions CRUD behavior", () => {
	test("create competition stores record with correct fields", async () => {
		const t = convexTest(schema, modules);
		const { directorId } = await seedDirectorAndVolunteer(t);
		const authed = t.withIdentity({ subject: directorId });

		const compId = await authed.mutation(api.competitions.api.create, {
			name: "Dublin Open 2026",
			description: "Annual competition",
			compStart: "2026-09-01",
			compEnd: "2026-09-02",
			organiserIds: [directorId],
		});

		const comp = await t.run((ctx) => ctx.db.get("competitions", compId));
		expect(comp?.name).toBe("Dublin Open 2026");
		expect(comp?.description).toBe("Annual competition");
		expect(comp?.compStart).toBe("2026-09-01");
		expect(comp?.compEnd).toBe("2026-09-02");
		expect(comp?.organiserIds).toEqual([directorId]);
		expect(comp?.updatedAt).toBeTypeOf("number");
	});

	test("create competition creates competitionAccess rows for organisers", async () => {
		const t = convexTest(schema, modules);
		const { directorId, volunteerId } = await seedDirectorAndVolunteer(t);
		const authed = t.withIdentity({ subject: directorId });

		const compId = await authed.mutation(api.competitions.api.create, {
			name: "Cork Open",
			compStart: "2026-10-01",
			compEnd: "2026-10-02",
			organiserIds: [directorId, volunteerId],
		});

		const accessRows = await t.run((ctx) =>
			ctx.db
				.query("competitionAccess")
				.withIndex("by_competition", (q) => q.eq("competitionId", compId))
				.collect(),
		);
		const userIds = accessRows.map((r) => r.userId);
		expect(userIds).toContain(directorId);
		expect(userIds).toContain(volunteerId);
	});

	test("update competition changes name and description", async () => {
		const t = convexTest(schema, modules);
		const { directorId } = await seedDirectorAndVolunteer(t);
		const authed = t.withIdentity({ subject: directorId });

		const compId = await authed.mutation(api.competitions.api.create, {
			name: "Old Name",
			compStart: "2026-11-01",
			compEnd: "2026-11-02",
			organiserIds: [directorId],
		});

		await authed.action(api.competitions.api.update, {
			competitionId: compId,
			updates: {
				name: "New Name",
				description: "Updated description",
			},
		});

		const comp = await t.run((ctx) => ctx.db.get("competitions", compId));
		expect(comp?.name).toBe("New Name");
		expect(comp?.description).toBe("Updated description");
	});

	test("update competition phase changes currentPhaseId", async () => {
		const t = convexTest(schema, modules);
		const { directorId } = await seedDirectorAndVolunteer(t);
		const authed = t.withIdentity({ subject: directorId });

		const phaseId = await t.run((ctx) =>
			ctx.db.insert("phases", {
				key: "planning",
				name: "Planning",
				description: "",
				order: 1,
				archived: false,
			}),
		);

		const compId = await authed.mutation(api.competitions.api.create, {
			name: "Phase Comp",
			compStart: "2026-12-01",
			compEnd: "2026-12-02",
			organiserIds: [directorId],
		});

		await authed.action(api.competitions.api.update, {
			competitionId: compId,
			updates: { currentPhaseId: phaseId },
		});

		const comp = await t.run((ctx) => ctx.db.get("competitions", compId));
		expect(comp?.currentPhaseId).toBe(phaseId);
	});

	test("update competition organisers syncs competitionAccess rows", async () => {
		const t = convexTest(schema, modules);
		const { directorId, volunteerId } = await seedDirectorAndVolunteer(t);
		const authed = t.withIdentity({ subject: directorId });

		const compId = await authed.mutation(api.competitions.api.create, {
			name: "Sync Comp",
			compStart: "2027-01-01",
			compEnd: "2027-01-02",
			organiserIds: [directorId],
		});

		// Add volunteerId as organiser
		await authed.action(api.competitions.api.update, {
			competitionId: compId,
			updates: { organiserIds: [directorId, volunteerId] },
		});

		const accessRows = await t.run((ctx) =>
			ctx.db
				.query("competitionAccess")
				.withIndex("by_competition", (q) => q.eq("competitionId", compId))
				.collect(),
		);
		const userIds = accessRows.map((r) => r.userId);
		expect(userIds).toContain(volunteerId);
	});

	test("delete competition removes the record and access rows", async () => {
		const t = convexTest(schema, modules);
		const { directorId } = await seedDirectorAndVolunteer(t);
		const authed = t.withIdentity({ subject: directorId });

		const compId = await authed.mutation(api.competitions.api.create, {
			name: "To Delete",
			compStart: "2027-02-01",
			compEnd: "2027-02-02",
			organiserIds: [directorId],
		});

		await authed.mutation(api.competitions.api.remove, {
			competitionId: compId,
		});

		const [comp, access] = await t.run((ctx) =>
			Promise.all([
				ctx.db.get("competitions", compId),
				ctx.db
					.query("competitionAccess")
					.withIndex("by_competition", (q) => q.eq("competitionId", compId))
					.collect(),
			]),
		);
		expect(comp).toBeNull();
		expect(access).toHaveLength(0);
	});
});
