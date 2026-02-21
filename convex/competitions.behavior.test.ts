import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { TEAM_NAMES } from "./lib/constants";
import schema from "./schema";
import { modules } from "./test.setup";

type CompetitionFixture = {
	userId: Id<"users">;
	phaseAId: Id<"phases">;
	phaseBId: Id<"phases">;
	competitionId: Id<"competitions">;
};

async function seedCompetitionFixture(
	t: ReturnType<typeof convexTest>,
): Promise<CompetitionFixture> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {});
		const now = Date.now();
		const phaseAId = await ctx.db.insert("phases", {
			key: "planning",
			name: "Planning",
			description: "Plan",
			order: 1,
			archived: false,
		});
		const phaseBId = await ctx.db.insert("phases", {
			key: "execution",
			name: "Execution",
			description: "Execute",
			order: 2,
			archived: false,
		});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Comp",
			description: "Desc",
			compStart: "2026-11-01",
			compEnd: "2026-11-02",
			compLeadId: userId,
			leadDelegateId: userId,
			organiserIds: [userId],
			currentPhaseId: phaseAId,
			compSheet: { type: "google-sheet", sheetId: "sheet-1" },
			updatedAt: now,
		});
		return { userId, phaseAId, phaseBId, competitionId };
	});
}

describe("competitions behavior characterization", () => {
	test("create is forbidden for non-volunteers", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });

		await expect(
			authed.mutation(api.competitions.create, {
				name: "Non-volunteer competition",
				description: "",
				compStart: "2026-12-01",
				compEnd: "2026-12-02",
			}),
		).rejects.toBeTruthy();
	});

	test("create succeeds for volunteers", async () => {
		const t = convexTest(schema, modules);
		const volunteerId = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {});
			await ctx.db.insert("teams", {
				name: "Volunteer",
				memberIds: [userId],
			});
			return userId;
		});
		const authed = t.withIdentity({ subject: volunteerId });

		const competitionId = await authed.mutation(api.competitions.create, {
			name: "Volunteer competition",
			description: "",
			compStart: "2026-12-10",
			compEnd: "2026-12-11",
			organiserIds: [volunteerId],
		});
		const created = await t.run((ctx) =>
			ctx.db.get("competitions", competitionId),
		);

		expect(created?.name).toBe("Volunteer competition");
	});

	test("update is forbidden for users without competition access", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const allowedUser = await ctx.db.insert("users", {});
			const deniedUser = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Restricted",
				description: "",
				compStart: "2026-11-01",
				compEnd: "2026-11-02",
				organiserIds: [allowedUser],
				updatedAt: Date.now(),
			});
			return { deniedUser, competitionId };
		});
		const denied = t.withIdentity({ subject: seeded.deniedUser });

		await expect(
			denied.mutation(api.competitions.update, {
				competitionId: seeded.competitionId,
				updates: { description: "Should fail" },
			}),
		).rejects.toBeTruthy();
	});

	test("update promotes backlog tasks in the new phase to to-do", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedCompetitionFixture(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		const taskIds = await t.run(async (ctx) => {
			const now = Date.now();
			const promotedTaskId = await ctx.db.insert("tasks", {
				identifier: "HQ-601",
				title: "Promote me",
				description: "",
				status: "backlog",
				priority: "medium",
				archived: false,
				parentCompetitionId: seeded.competitionId,
				phaseId: seeded.phaseBId,
				labelIds: [],
				updatedAt: now,
			});
			const samePhaseNonBacklogId = await ctx.db.insert("tasks", {
				identifier: "HQ-602",
				title: "Already active",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: seeded.competitionId,
				phaseId: seeded.phaseBId,
				labelIds: [],
				updatedAt: now,
			});
			const otherPhaseBacklogId = await ctx.db.insert("tasks", {
				identifier: "HQ-603",
				title: "Different phase",
				description: "",
				status: "backlog",
				priority: "medium",
				archived: false,
				parentCompetitionId: seeded.competitionId,
				phaseId: seeded.phaseAId,
				labelIds: [],
				updatedAt: now,
			});
			const archivedBacklogInNewPhaseId = await ctx.db.insert("tasks", {
				identifier: "HQ-605",
				title: "Archived in new phase",
				description: "",
				status: "backlog",
				priority: "medium",
				archived: true,
				parentCompetitionId: seeded.competitionId,
				phaseId: seeded.phaseBId,
				labelIds: [],
				updatedAt: now,
			});
			return {
				promotedTaskId,
				samePhaseNonBacklogId,
				otherPhaseBacklogId,
				archivedBacklogInNewPhaseId,
			};
		});

		await authed.mutation(api.competitions.update, {
			competitionId: seeded.competitionId,
			updates: { currentPhaseId: seeded.phaseBId },
		});

		const [promoted, samePhaseNonBacklog, otherPhaseBacklog, archivedBacklog] =
			await t.run((ctx) =>
				Promise.all([
					ctx.db.get("tasks", taskIds.promotedTaskId),
					ctx.db.get("tasks", taskIds.samePhaseNonBacklogId),
					ctx.db.get("tasks", taskIds.otherPhaseBacklogId),
					ctx.db.get("tasks", taskIds.archivedBacklogInNewPhaseId),
				]),
			);

		expect(promoted?.status).toBe("to-do");
		expect(samePhaseNonBacklog?.status).toBe("to-do");
		expect(otherPhaseBacklog?.status).toBe("backlog");
		expect(archivedBacklog?.status).toBe("backlog");
	});

	test("update does not promote tasks when current phase does not change", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedCompetitionFixture(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		const taskId = await t.run((ctx) =>
			ctx.db.insert("tasks", {
				identifier: "HQ-604",
				title: "No phase change",
				description: "",
				status: "backlog",
				priority: "medium",
				archived: false,
				parentCompetitionId: seeded.competitionId,
				phaseId: seeded.phaseAId,
				labelIds: [],
				updatedAt: Date.now(),
			}),
		);

		await authed.mutation(api.competitions.update, {
			competitionId: seeded.competitionId,
			updates: { description: "Rename only" },
		});

		const task = await t.run((ctx) => ctx.db.get("tasks", taskId));
		expect(task?.status).toBe("backlog");
	});

	test("update clears nullable fields when null values are provided", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedCompetitionFixture(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		await authed.mutation(api.competitions.update, {
			competitionId: seeded.competitionId,
			updates: {
				compLeadId: null,
				leadDelegateId: null,
				compSheet: null,
			},
		});

		const updated = await authed.query(api.competitions.get, {
			competitionId: seeded.competitionId,
		});
		expect(updated).toBeTruthy();
		expect(updated?.compLeadId).toBeUndefined();
		expect(updated?.leadDelegateId).toBeUndefined();
		expect(updated?.compSheet).toBeUndefined();
	});

	test("manual sponsor status update requires sponsorship manager permission", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Permission Check",
				description: "",
				compStart: "2026-11-01",
				compEnd: "2026-11-02",
				compLeadId: userId,
				organiserIds: [userId],
				updatedAt: Date.now(),
			});
			return { userId, competitionId };
		});
		const authed = t.withIdentity({ subject: seeded.userId });

		await expect(
			authed.mutation(api.competitions.update, {
				competitionId: seeded.competitionId,
				updates: { manualSponsorPropertyStatus: "none" },
			}),
		).rejects.toBeTruthy();
	});

	test("manual sponsor status override is applied and can be cleared", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const managerId = await ctx.db.insert("users", {});
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.FINANCE,
				memberIds: [managerId],
			});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Override Check",
				description: "",
				compStart: "2026-11-01",
				compEnd: "2026-11-02",
				compLeadId: managerId,
				organiserIds: [managerId],
				updatedAt: Date.now(),
			});
			const winnerSponsorId = await ctx.db.insert("sponsors", {
				name: "Winner Sponsor",
				email: "winner@example.com",
				emailNormalized: "winner@example.com",
				active: true,
				createdById: managerId,
				updatedById: managerId,
				updatedAt: Date.now(),
			});
			const manualSponsorId = await ctx.db.insert("sponsors", {
				name: "Manual Sponsor",
				email: "manual@example.com",
				emailNormalized: "manual@example.com",
				active: true,
				createdById: managerId,
				updatedById: managerId,
				updatedAt: Date.now(),
			});
			await ctx.db.insert("sponsorshipAuctions", {
				competitionId,
				framework: "first_sealed",
				state: "closed",
				currency: "EUR",
				startsAt: Date.now() - 100_000,
				endsAt: Date.now() - 50_000,
				antiSnipingWindowMs: 300_000,
				antiSnipingExtendMs: 300_000,
				startPriceCents: 10_000,
				currentPriceCents: 15_000,
				winnerSponsorId,
				settlementAmountCents: 15_000,
				createdById: managerId,
				updatedById: managerId,
				updatedAt: Date.now(),
			});
			return { managerId, competitionId, manualSponsorId };
		});
		const authed = t.withIdentity({ subject: seeded.managerId });

		const beforeOverride = await authed.query(api.competitions.getForUI, {
			competitionId: seeded.competitionId,
		});
		expect(beforeOverride?.sponsorPropertyStatus).toBe("sponsor");

		await authed.mutation(api.competitions.update, {
			competitionId: seeded.competitionId,
			updates: { manualSponsorPropertyStatus: "none" },
		});
		const overridden = await authed.query(api.competitions.getForUI, {
			competitionId: seeded.competitionId,
		});
		expect(overridden?.sponsorPropertyStatus).toBe("none");

		await authed.mutation(api.competitions.update, {
			competitionId: seeded.competitionId,
			updates: {
				manualSponsorPropertyStatus: "sponsor",
				manualSponsorId: seeded.manualSponsorId,
			},
		});
		const manualSponsorOverride = await authed.query(
			api.competitions.getForUI,
			{
				competitionId: seeded.competitionId,
			},
		);
		expect(manualSponsorOverride?.sponsorPropertyStatus).toBe("sponsor");
		expect(manualSponsorOverride?.sponsorPropertyDisplay).toBe(
			"Manual Sponsor",
		);

		await authed.mutation(api.competitions.update, {
			competitionId: seeded.competitionId,
			updates: { manualSponsorPropertyStatus: null, manualSponsorId: null },
		});
		const afterClear = await authed.query(api.competitions.getForUI, {
			competitionId: seeded.competitionId,
		});
		expect(afterClear?.sponsorPropertyStatus).toBe("sponsor");
	});
});
