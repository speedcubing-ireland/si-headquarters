import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { TEAM_NAMES } from "./lib/constants";
import schema from "./schema";
import { modules } from "./test.setup";

type ConvexTest = ReturnType<typeof convexTest>;

async function seedUserInTeam(
	t: ConvexTest,
	teamName: string,
): Promise<{ userId: Id<"users"> }> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {
			email: `${teamName.toLowerCase().replace(/\s+/g, "-")}@example.com`,
		});
		await ctx.db.insert("teams", {
			name: teamName,
			memberIds: [userId],
		});
		return { userId };
	});
}

async function seedUserInNoTeam(
	t: ConvexTest,
): Promise<{ userId: Id<"users"> }> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {
			email: "no-team@example.com",
		});
		return { userId };
	});
}

describe("permissions policy matrix", () => {
	describe("getPermissionSnapshot", () => {
		test("director: only Directors team has isDirector", async () => {
			const t = convexTest(schema, modules);
			const director = await seedUserInTeam(t, TEAM_NAMES.DIRECTORS);
			const volunteer = await seedUserInTeam(t, TEAM_NAMES.VOLUNTEER);
			const none = await seedUserInNoTeam(t);

			const directorSnap = await t
				.withIdentity({ subject: director.userId })
				.query(api.admin.getPermissionSnapshot, {});
			const volunteerSnap = await t
				.withIdentity({ subject: volunteer.userId })
				.query(api.admin.getPermissionSnapshot, {});
			const noneSnap = await t
				.withIdentity({ subject: none.userId })
				.query(api.admin.getPermissionSnapshot, {});

			expect(directorSnap.isDirector).toBe(true);
			expect(volunteerSnap.isDirector).toBe(false);
			expect(noneSnap.isDirector).toBe(false);
		});

		test("delegate: only Delegates team has isDelegate", async () => {
			const t = convexTest(schema, modules);
			const delegate = await seedUserInTeam(t, TEAM_NAMES.DELEGATES);
			const director = await seedUserInTeam(t, TEAM_NAMES.DIRECTORS);
			const none = await seedUserInNoTeam(t);

			const delegateSnap = await t
				.withIdentity({ subject: delegate.userId })
				.query(api.admin.getPermissionSnapshot, {});
			const directorSnap = await t
				.withIdentity({ subject: director.userId })
				.query(api.admin.getPermissionSnapshot, {});
			const noneSnap = await t
				.withIdentity({ subject: none.userId })
				.query(api.admin.getPermissionSnapshot, {});

			expect(delegateSnap.isDelegate).toBe(true);
			expect(directorSnap.isDelegate).toBe(false);
			expect(noneSnap.isDelegate).toBe(false);
		});

		test("volunteer: only Volunteer team has isVolunteer", async () => {
			const t = convexTest(schema, modules);
			const director = await seedUserInTeam(t, TEAM_NAMES.DIRECTORS);
			const volunteer = await seedUserInTeam(t, TEAM_NAMES.VOLUNTEER);
			const none = await seedUserInNoTeam(t);

			const directorSnap = await t
				.withIdentity({ subject: director.userId })
				.query(api.admin.getPermissionSnapshot, {});
			const volunteerSnap = await t
				.withIdentity({ subject: volunteer.userId })
				.query(api.admin.getPermissionSnapshot, {});
			const noneSnap = await t
				.withIdentity({ subject: none.userId })
				.query(api.admin.getPermissionSnapshot, {});

			expect(directorSnap.isVolunteer).toBe(false);
			expect(volunteerSnap.isVolunteer).toBe(true);
			expect(noneSnap.isVolunteer).toBe(false);
		});

		test("canAccessWca2fa: Directors and Competitions only", async () => {
			const t = convexTest(schema, modules);
			const directors = await seedUserInTeam(t, TEAM_NAMES.DIRECTORS);
			const competitions = await seedUserInTeam(t, TEAM_NAMES.COMPETITIONS);
			const finance = await seedUserInTeam(t, TEAM_NAMES.FINANCE);
			const none = await seedUserInNoTeam(t);

			expect(
				await t
					.withIdentity({ subject: directors.userId })
					.query(api.admin.canAccessWca2fa, {}),
			).toBe(true);
			expect(
				await t
					.withIdentity({ subject: competitions.userId })
					.query(api.admin.canAccessWca2fa, {}),
			).toBe(true);
			expect(
				await t
					.withIdentity({ subject: finance.userId })
					.query(api.admin.canAccessWca2fa, {}),
			).toBe(false);
			expect(
				await t
					.withIdentity({ subject: none.userId })
					.query(api.admin.canAccessWca2fa, {}),
			).toBe(false);
		});

		test("isSponsorshipManager: Directors and Finance only", async () => {
			const t = convexTest(schema, modules);
			const directors = await seedUserInTeam(t, TEAM_NAMES.DIRECTORS);
			const finance = await seedUserInTeam(t, TEAM_NAMES.FINANCE);
			const competitions = await seedUserInTeam(t, TEAM_NAMES.COMPETITIONS);
			const none = await seedUserInNoTeam(t);

			const snapD = await t
				.withIdentity({ subject: directors.userId })
				.query(api.admin.getPermissionSnapshot, {});
			const snapF = await t
				.withIdentity({ subject: finance.userId })
				.query(api.admin.getPermissionSnapshot, {});
			const snapC = await t
				.withIdentity({ subject: competitions.userId })
				.query(api.admin.getPermissionSnapshot, {});
			const snapN = await t
				.withIdentity({ subject: none.userId })
				.query(api.admin.getPermissionSnapshot, {});

			expect(snapD.isSponsorshipManager).toBe(true);
			expect(snapF.isSponsorshipManager).toBe(true);
			expect(snapC.isSponsorshipManager).toBe(false);
			expect(snapN.isSponsorshipManager).toBe(false);
		});

		test("canAccessSocialMediaDashboard: Directors and Social Media only", async () => {
			const t = convexTest(schema, modules);
			const directors = await seedUserInTeam(t, TEAM_NAMES.DIRECTORS);
			const social = await seedUserInTeam(t, TEAM_NAMES.SOCIAL_MEDIA);
			const finance = await seedUserInTeam(t, TEAM_NAMES.FINANCE);
			const none = await seedUserInNoTeam(t);

			expect(
				await t
					.withIdentity({ subject: directors.userId })
					.query(api.admin.canAccessSocialMediaDashboard, {}),
			).toBe(true);
			expect(
				await t
					.withIdentity({ subject: social.userId })
					.query(api.admin.canAccessSocialMediaDashboard, {}),
			).toBe(true);
			expect(
				await t
					.withIdentity({ subject: finance.userId })
					.query(api.admin.canAccessSocialMediaDashboard, {}),
			).toBe(false);
			expect(
				await t
					.withIdentity({ subject: none.userId })
					.query(api.admin.canAccessSocialMediaDashboard, {}),
			).toBe(false);
		});
	});

	describe("director-only operations", () => {
		test("addPendingTeamMember: director succeeds, non-director is forbidden", async () => {
			const t = convexTest(schema, modules);
			const { userId: directorId } = await seedUserInTeam(
				t,
				TEAM_NAMES.DIRECTORS,
			);
			const { userId: volunteerId } = await seedUserInTeam(
				t,
				TEAM_NAMES.VOLUNTEER,
			);
			const teamId = await t.run(async (ctx) => {
				return ctx.db.insert("teams", {
					name: TEAM_NAMES.SOFTWARE,
					memberIds: [],
				});
			});

			const director = t.withIdentity({ subject: directorId });
			const volunteer = t.withIdentity({ subject: volunteerId });

			await director.mutation(api.admin.addPendingTeamMember, {
				teamId,
				email: "new@example.com",
			});

			await expect(
				volunteer.mutation(api.admin.addPendingTeamMember, {
					teamId,
					email: "other@example.com",
				}),
			).rejects.toBeTruthy();
		});

		test("linkedActions.createDefinition: director succeeds, non-director is forbidden", async () => {
			const t = convexTest(schema, modules);
			const { userId: directorId } = await seedUserInTeam(
				t,
				TEAM_NAMES.DIRECTORS,
			);
			const { userId: volunteerId } = await seedUserInTeam(
				t,
				TEAM_NAMES.VOLUNTEER,
			);

			const director = t.withIdentity({ subject: directorId });
			const volunteer = t.withIdentity({ subject: volunteerId });

			const id = await director.mutation(
				api.integrations.linkedActions.createDefinition,
				{
					name: "Test Sheet",
					shortId: "sheet.policy-test",
					type: "linked_sheet",
					config: { operation: "populate_checkin_sheet" },
				},
			);
			expect(id).toBeDefined();

			await expect(
				volunteer.mutation(api.integrations.linkedActions.createDefinition, {
					name: "Other",
					shortId: "sheet.other",
					type: "linked_sheet",
					config: { operation: "populate_checkin_sheet" },
				}),
			).rejects.toBeTruthy();
		});
	});
});
