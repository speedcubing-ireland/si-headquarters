import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

async function seedVolunteer(
	t: ReturnType<typeof convexTest>,
): Promise<Id<"users">> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [userId],
		});
		return userId;
	});
}

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

describe("weekendOverrides behavior", () => {
	test("setOverride creates a new weekend override record", async () => {
		const t = convexTest(schema, modules);
		const userId = await seedVolunteer(t);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.competitions.weekendOverrides.setOverride, {
			satDate: "2026-04-04",
			eventNote: "Test event",
			reserved: true,
		});

		const rows = await authed.query(api.competitions.weekendOverrides.list, {});
		expect(rows).toHaveLength(1);
		expect(rows[0]?.satDate).toBe("2026-04-04");
		expect(rows[0]?.eventNote).toBe("Test event");
		expect(rows[0]?.reserved).toBe(true);
	});

	test("setOverride updates existing record for same satDate", async () => {
		const t = convexTest(schema, modules);
		const userId = await seedVolunteer(t);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.competitions.weekendOverrides.setOverride, {
			satDate: "2026-04-04",
			eventNote: "First",
			reserved: true,
		});
		await authed.mutation(api.competitions.weekendOverrides.setOverride, {
			satDate: "2026-04-04",
			eventNote: "Updated",
		});

		const rows = await authed.query(api.competitions.weekendOverrides.list, {});
		expect(rows).toHaveLength(1);
		expect(rows[0]?.eventNote).toBe("Updated");
		expect(rows[0]?.reserved).toBe(true);
	});

	test("clearAll deletes all override records (director only)", async () => {
		const t = convexTest(schema, modules);
		const volunteerId = await seedVolunteer(t);
		const directorId = await seedDirector(t);
		const volunteer = t.withIdentity({ subject: volunteerId });
		const director = t.withIdentity({ subject: directorId });

		await volunteer.mutation(api.competitions.weekendOverrides.setOverride, {
			satDate: "2026-04-04",
			reserved: true,
		});
		await volunteer.mutation(api.competitions.weekendOverrides.setOverride, {
			satDate: "2026-04-11",
			announced: true,
		});

		let rows = await director.query(api.competitions.weekendOverrides.list, {});
		expect(rows).toHaveLength(2);

		await director.mutation(api.competitions.weekendOverrides.clearAll, {});
		rows = await director.query(api.competitions.weekendOverrides.list, {});
		expect(rows).toHaveLength(0);
	});

	test("list returns all overrides", async () => {
		const t = convexTest(schema, modules);
		const volunteerId = await seedVolunteer(t);
		const volunteer = t.withIdentity({ subject: volunteerId });

		await volunteer.mutation(api.competitions.weekendOverrides.setOverride, {
			satDate: "2026-04-04",
			eventNote: "Event A",
		});
		await volunteer.mutation(api.competitions.weekendOverrides.setOverride, {
			satDate: "2026-04-11",
			eventNote: "Event B",
		});

		const rows = await volunteer.query(
			api.competitions.weekendOverrides.list,
			{},
		);
		expect(rows).toHaveLength(2);
	});
});
