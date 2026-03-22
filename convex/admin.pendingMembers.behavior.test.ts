import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { TEAM_NAMES } from "./lib/constants";

async function seedDirectorWithTeam(t: ReturnType<typeof convexTest>): Promise<{
	directorId: Id<"users">;
	teamId: Id<"teams">;
}> {
	return t.run(async (ctx) => {
		const directorId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.DIRECTORS,
			memberIds: [directorId],
		});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [directorId],
		});
		const teamId = await ctx.db.insert("teams", {
			name: "Graphics Team",
			memberIds: [],
		});
		return { directorId, teamId };
	});
}

describe("pending team members behavior", () => {
	test("addPendingTeamMember creates pending record for unknown email", async () => {
		const t = convexTest(schema, modules);
		const { directorId, teamId } = await seedDirectorWithTeam(t);
		const director = t.withIdentity({ subject: directorId });

		await director.mutation(api.admin.addPendingTeamMember, {
			teamId,
			email: "newperson@example.com",
		});

		const pending = await t.run((ctx) =>
			ctx.db.query("pendingTeamMembers").collect(),
		);
		const found = pending.find(
			(p) => p.email === "newperson@example.com" && p.teamId === teamId,
		);
		expect(found).toBeTruthy();
	});

	test("addPendingTeamMember for existing user adds them to team directly", async () => {
		const t = convexTest(schema, modules);
		const { directorId, teamId } = await seedDirectorWithTeam(t);

		// Create a user with a known email
		const existingUserId = await t.run(async (ctx) =>
			ctx.db.insert("users", { email: "exists@example.com" }),
		);

		const director = t.withIdentity({ subject: directorId });
		await director.mutation(api.admin.addPendingTeamMember, {
			teamId,
			email: "exists@example.com",
		});

		const team = await t.run((ctx) => ctx.db.get("teams", teamId));
		expect(team?.memberIds).toContain(existingUserId);
	});

	test("removePendingTeamMember deletes the pending record", async () => {
		const t = convexTest(schema, modules);
		const { directorId, teamId } = await seedDirectorWithTeam(t);
		const director = t.withIdentity({ subject: directorId });

		await director.mutation(api.admin.addPendingTeamMember, {
			teamId,
			email: "toremove@example.com",
		});

		const pending = await t.run((ctx) =>
			ctx.db.query("pendingTeamMembers").collect(),
		);
		const record = pending.find((p) => p.email === "toremove@example.com");
		expect(record).toBeDefined();
		const recordId = record?._id as Id<"pendingTeamMembers">;

		await director.mutation(api.admin.removePendingTeamMember, {
			pendingTeamMemberId: recordId,
		});

		const afterRemove = await t.run((ctx) =>
			ctx.db.get("pendingTeamMembers", recordId),
		);
		expect(afterRemove).toBeNull();
	});

	test("addPendingTeamMember rejects non-directors", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const teamId = await t.run((ctx) =>
			ctx.db.insert("teams", { name: "Test", memberIds: [] }),
		);
		const authed = t.withIdentity({ subject: userId });

		await expect(
			authed.mutation(api.admin.addPendingTeamMember, {
				teamId,
				email: "nope@example.com",
			}),
		).rejects.toBeTruthy();
	});
});
