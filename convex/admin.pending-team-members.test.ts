import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

type DirectorFixture = {
	directorId: Id<"users">;
	teamId: Id<"teams">;
};

async function seedDirectorFixture(
	t: ReturnType<typeof convexTest>,
): Promise<DirectorFixture> {
	return t.run(async (ctx) => {
		const directorId = await ctx.db.insert("users", {
			email: "director@example.com",
		});
		await ctx.db.insert("teams", {
			name: "Directors",
			memberIds: [directorId],
		});
		const teamId = await ctx.db.insert("teams", {
			name: "Software Team",
			memberIds: [],
		});
		return { directorId, teamId };
	});
}

describe("admin pending team members", () => {
	test("addPendingTeamMember stores normalized email for users who do not exist yet", async () => {
		const t = convexTest(schema, modules);
		const { directorId, teamId } = await seedDirectorFixture(t);
		const director = t.withIdentity({ subject: directorId });

		await director.mutation(api.admin.addPendingTeamMember, {
			teamId,
			email: " New.Member@Example.com ",
		});

		const rows = await t.run((ctx) =>
			ctx.db.query("pendingTeamMembers").collect(),
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.email).toBe("new.member@example.com");
		expect(rows[0]?.teamId).toBe(teamId);

		const listing = await director.query(api.admin.listMembersAndTeams, {});
		expect(listing.pendingTeamMembers).toHaveLength(1);
		expect(listing.pendingTeamMembers[0]?.teamName).toBe("Software Team");
	});

	test("addPendingTeamMember adds existing users to team immediately", async () => {
		const t = convexTest(schema, modules);
		const { directorId, teamId } = await seedDirectorFixture(t);
		const existingUserId = await t.run((ctx) =>
			ctx.db.insert("users", {
				email: "member@example.com",
			}),
		);
		const director = t.withIdentity({ subject: directorId });

		await director.mutation(api.admin.addPendingTeamMember, {
			teamId,
			email: "member@example.com",
		});

		const [team, rows] = await t.run((ctx) =>
			Promise.all([
				ctx.db.get("teams", teamId),
				ctx.db.query("pendingTeamMembers").collect(),
			]),
		);
		expect(team?.memberIds).toContain(existingUserId);
		expect(rows).toHaveLength(0);
	});

	test("ensureVolunteerAccess applies pending team memberships on login", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {
				email: "future.member@example.com",
			});
			const teamId = await ctx.db.insert("teams", {
				name: "Graphics Team",
				memberIds: [],
			});
			const pendingId = await ctx.db.insert("pendingTeamMembers", {
				email: "future.member@example.com",
				teamId,
				createdById: userId,
				createdAt: Date.now(),
			});
			return { userId, teamId, pendingId };
		});

		const authedUser = t.withIdentity({ subject: seeded.userId });
		await authedUser.mutation(api.users.ensureVolunteerAccess, {});

		const [team, pending] = await t.run((ctx) =>
			Promise.all([
				ctx.db.get("teams", seeded.teamId),
				ctx.db.get("pendingTeamMembers", seeded.pendingId),
			]),
		);
		expect(team?.memberIds).toContain(seeded.userId);
		expect(pending).toBeNull();
	});
});
