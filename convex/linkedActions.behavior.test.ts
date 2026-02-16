import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { TEAM_NAMES } from "./lib/constants";
import schema from "./schema";
import { modules } from "./test.setup";

async function seedTaskAccessFixture(
	t: ReturnType<typeof convexTest>,
): Promise<{
	userId: Id<"users">;
	taskId: Id<"tasks">;
	competitionId: Id<"competitions">;
}> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [userId],
		});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Comp",
			description: "",
			compStart: "2026-07-01",
			compEnd: "2026-07-02",
			organiserIds: [userId],
			updatedAt: Date.now(),
		});
		await ctx.db.insert("competitionAccess", {
			competitionId,
			userId,
		});
		const taskId = await ctx.db.insert("tasks", {
			identifier: "HQ-LINKED-1",
			title: "Task with linked integrations",
			description: "",
			status: "to-do",
			priority: "medium",
			archived: false,
			parentCompetitionId: competitionId,
			labelIds: [],
			updatedAt: Date.now(),
		});
		return { userId, taskId, competitionId };
	});
}

describe("linkedActions behavior characterization", () => {
	test("createDefinition is director-only", async () => {
		const t = convexTest(schema, modules);
		const nonDirectorId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: nonDirectorId });

		await expect(
			authed.mutation(api.linkedActions.createDefinition, {
				name: "Check-in Sheet",
				shortId: "sheet.populate-checkin",
				type: "linked_sheet",
				config: { operation: "populate_checkin_sheet" },
			}),
		).rejects.toBeTruthy();
	});

	test("createDefinition rejects Canva URLs and accepts canonical IDs", async () => {
		const t = convexTest(schema, modules);
		const directorId = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {});
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.DIRECTORS,
				memberIds: [userId],
			});
			return userId;
		});
		const authed = t.withIdentity({ subject: directorId });

		await expect(
			authed.mutation(api.linkedActions.createDefinition, {
				name: "Certificates",
				shortId: "canva.cert.bad-url",
				type: "canva_template",
				config: {
					sourceBrandTemplateId:
						"https://www.canva.com/design/DAG_bVVbgUM/ttYM-SpMZAY0znZpQSvfcQ/edit",
					destinationFolderId: "https://www.canva.com/folder/FAF-UVeKpXI",
					naming: {
						mode: "parent_plus_suffix",
						defaultSuffix: "Certificates",
					},
				},
			}),
		).rejects.toBeTruthy();

		await expect(
			authed.mutation(api.linkedActions.createDefinition, {
				name: "Certificates",
				shortId: "canva.cert.bad-shared",
				type: "canva_template",
				config: {
					sourceBrandTemplateId: "DAG_bVVbgUM",
					destinationFolderId: "shared",
					naming: {
						mode: "parent_plus_suffix",
						defaultSuffix: "Certificates",
					},
				},
			}),
		).rejects.toBeTruthy();

		const definitionId = await authed.mutation(
			api.linkedActions.createDefinition,
			{
				name: "Certificates",
				shortId: "canva.cert.good-id",
				type: "canva_template",
				config: {
					sourceBrandTemplateId: "DAG_bVVbgUM",
					destinationFolderId: "FAF-UVeKpXI",
					naming: {
						mode: "parent_plus_suffix",
						defaultSuffix: "Certificates",
					},
				},
			},
		);

		const row = await t.run((ctx) =>
			ctx.db.get("linkedActionDefinitions", definitionId),
		);
		expect(row?.type).toBe("canva_template");
		expect(row?.config).toMatchObject({
			sourceBrandTemplateId: "DAG_bVVbgUM",
			destinationFolderId: "FAF-UVeKpXI",
		});
	});

	test("attachToTask is idempotent for (taskId, linkedActionId)", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskAccessFixture(t);
		const authed = t.withIdentity({ subject: seeded.userId });
		const definitionId = await t.run(async (ctx) => {
			const directorId = await ctx.db.insert("users", {});
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.DIRECTORS,
				memberIds: [directorId],
			});
			return ctx.db.insert("linkedActionDefinitions", {
				name: "Check-in Sheet",
				shortId: "sheet.populate-checkin",
				type: "linked_sheet",
				runPermission: "volunteer",
				config: { operation: "populate_checkin_sheet" },
				archived: false,
				createdById: directorId,
				updatedById: directorId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
		});

		const firstAttachId = await authed.mutation(
			api.linkedActions.attachToTask,
			{
				taskId: seeded.taskId,
				linkedActionId: definitionId,
			},
		);
		const secondAttachId = await authed.mutation(
			api.linkedActions.attachToTask,
			{
				taskId: seeded.taskId,
				linkedActionId: definitionId,
			},
		);

		const rows = await t.run((ctx) =>
			ctx.db
				.query("taskLinkedActions")
				.withIndex("by_task", (q) => q.eq("taskId", seeded.taskId))
				.collect(),
		);
		expect(firstAttachId).toBe(secondAttachId);
		expect(rows).toHaveLength(1);
		expect(rows[0].linkedActionId).toBe(definitionId);
	});

	test("runTaskLinkedAction reports error when check-in sheet preconditions are missing", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskAccessFixture(t);
		const authed = t.withIdentity({ subject: seeded.userId });
		const setup = await t.run(async (ctx) => {
			const definitionId = await ctx.db.insert("linkedActionDefinitions", {
				name: "Check-in Sheet",
				shortId: "sheet.populate-checkin",
				type: "linked_sheet",
				runPermission: "volunteer",
				config: { operation: "populate_checkin_sheet" },
				archived: false,
				createdById: seeded.userId,
				updatedById: seeded.userId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			const taskLinkedActionId = await ctx.db.insert("taskLinkedActions", {
				taskId: seeded.taskId,
				linkedActionId: definitionId,
				status: "idle",
				createdById: seeded.userId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			return { taskLinkedActionId };
		});

		const result = await authed.action(api.linkedActions.runTaskLinkedAction, {
			taskId: seeded.taskId,
			taskLinkedActionId: setup.taskLinkedActionId,
		});
		expect(result.success).toBe(false);
		expect(result.message).toContain(
			"Competition is not linked to WCA. Link it first.",
		);

		const row = await t.run((ctx) =>
			ctx.db.get("taskLinkedActions", setup.taskLinkedActionId),
		);
		expect(row?.status).toBe("error");
		expect(row?.lastRunMessage).toContain(
			"Competition is not linked to WCA. Link it first.",
		);
	});

	test("assignee run permission allows only task assignee", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const assigneeId = await ctx.db.insert("users", {});
			const nonAssigneeId = await ctx.db.insert("users", {});
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.VOLUNTEER,
				memberIds: [assigneeId, nonAssigneeId],
			});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Comp",
				description: "",
				compStart: "2026-09-01",
				compEnd: "2026-09-02",
				organiserIds: [assigneeId, nonAssigneeId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: assigneeId,
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: nonAssigneeId,
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-LINKED-ASSIGNEE",
				title: "Task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				assigneeId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			const definitionId = await ctx.db.insert("linkedActionDefinitions", {
				name: "Check-in Sheet",
				shortId: "sheet.assignee-only",
				type: "linked_sheet",
				runPermission: "assignee",
				config: { operation: "populate_checkin_sheet" },
				archived: false,
				createdById: assigneeId,
				updatedById: assigneeId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			const taskLinkedActionId = await ctx.db.insert("taskLinkedActions", {
				taskId,
				linkedActionId: definitionId,
				status: "idle",
				createdById: assigneeId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			return { assigneeId, nonAssigneeId, taskId, taskLinkedActionId };
		});
		const assignee = t.withIdentity({ subject: seeded.assigneeId });
		const nonAssignee = t.withIdentity({ subject: seeded.nonAssigneeId });

		const [assigneeList, nonAssigneeList] = await Promise.all([
			assignee.query(api.linkedActions.listForTask, { taskId: seeded.taskId }),
			nonAssignee.query(api.linkedActions.listForTask, {
				taskId: seeded.taskId,
			}),
		]);
		expect(assigneeList[0]?.canRun).toBe(true);
		expect(nonAssigneeList[0]?.canRun).toBe(false);

		const deniedResult = await nonAssignee.action(
			api.linkedActions.runTaskLinkedAction,
			{
				taskId: seeded.taskId,
				taskLinkedActionId: seeded.taskLinkedActionId,
			},
		);
		expect(deniedResult).toEqual({
			success: false,
			message: "You do not have permission to run this linked integration.",
		});
	});

	test("owner run permission allows team owners only", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const teamMemberId = await ctx.db.insert("users", {});
			const otherUserId = await ctx.db.insert("users", {});
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.VOLUNTEER,
				memberIds: [teamMemberId, otherUserId],
			});
			const ownerTeamId = await ctx.db.insert("teams", {
				name: "Owners",
				memberIds: [teamMemberId],
			});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Comp",
				description: "",
				compStart: "2026-10-01",
				compEnd: "2026-10-02",
				organiserIds: [teamMemberId, otherUserId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: teamMemberId,
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: otherUserId,
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-LINKED-OWNER",
				title: "Task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				ownerType: "team",
				ownerId: ownerTeamId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			const definitionId = await ctx.db.insert("linkedActionDefinitions", {
				name: "Check-in Sheet",
				shortId: "sheet.owner-only",
				type: "linked_sheet",
				runPermission: "owner",
				config: { operation: "populate_checkin_sheet" },
				archived: false,
				createdById: teamMemberId,
				updatedById: teamMemberId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			await ctx.db.insert("taskLinkedActions", {
				taskId,
				linkedActionId: definitionId,
				status: "idle",
				createdById: teamMemberId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			return { taskId, teamMemberId, otherUserId };
		});
		const ownerUser = t.withIdentity({ subject: seeded.teamMemberId });
		const otherUser = t.withIdentity({ subject: seeded.otherUserId });

		const [ownerList, otherList] = await Promise.all([
			ownerUser.query(api.linkedActions.listForTask, { taskId: seeded.taskId }),
			otherUser.query(api.linkedActions.listForTask, { taskId: seeded.taskId }),
		]);
		expect(ownerList[0]?.canRun).toBe(true);
		expect(otherList[0]?.canRun).toBe(false);
	});

	test("non-volunteers cannot run Canva linked integrations even when permission is anyone", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Comp",
				description: "",
				compStart: "2026-11-01",
				compEnd: "2026-11-02",
				organiserIds: [userId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId,
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-LINKED-NONVOL",
				title: "Task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			const definitionId = await ctx.db.insert("linkedActionDefinitions", {
				name: "Certificates",
				shortId: "canva.anyone",
				type: "canva_template",
				runPermission: "anyone",
				config: {
					sourceBrandTemplateId: "DAG_bVVbgUM",
					destinationFolderId: "FAF-UVeKpXI",
					naming: {
						mode: "parent_plus_suffix",
						defaultSuffix: "Certificates",
					},
				},
				archived: false,
				createdById: userId,
				updatedById: userId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			const taskLinkedActionId = await ctx.db.insert("taskLinkedActions", {
				taskId,
				linkedActionId: definitionId,
				status: "idle",
				createdById: userId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			return { userId, taskId, taskLinkedActionId };
		});
		const authed = t.withIdentity({ subject: seeded.userId });

		const list = await authed.query(api.linkedActions.listForTask, {
			taskId: seeded.taskId,
		});
		expect(list[0]?.canRun).toBe(false);

		const result = await authed.action(api.linkedActions.runTaskLinkedAction, {
			taskId: seeded.taskId,
			taskLinkedActionId: seeded.taskLinkedActionId,
		});
		expect(result).toEqual({
			success: false,
			message: "You do not have permission to run this linked integration.",
		});
	});

	test("non-volunteers can run linked sheet actions when permission is anyone", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Comp",
				description: "",
				compStart: "2027-01-01",
				compEnd: "2027-01-02",
				organiserIds: [userId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId,
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-LINKED-SHEET-ANYONE",
				title: "Task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			const definitionId = await ctx.db.insert("linkedActionDefinitions", {
				name: "Check-in Sheet",
				shortId: "sheet.anyone",
				type: "linked_sheet",
				runPermission: "anyone",
				config: { operation: "populate_checkin_sheet" },
				archived: false,
				createdById: userId,
				updatedById: userId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			const taskLinkedActionId = await ctx.db.insert("taskLinkedActions", {
				taskId,
				linkedActionId: definitionId,
				status: "idle",
				createdById: userId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			return { userId, taskId, taskLinkedActionId };
		});
		const authed = t.withIdentity({ subject: seeded.userId });

		const list = await authed.query(api.linkedActions.listForTask, {
			taskId: seeded.taskId,
		});
		expect(list[0]?.canRun).toBe(true);

		const result = await authed.action(api.linkedActions.runTaskLinkedAction, {
			taskId: seeded.taskId,
			taskLinkedActionId: seeded.taskLinkedActionId,
		});
		expect(result.success).toBe(false);
		expect(result.message).toContain(
			"Competition is not linked to WCA. Link it first.",
		);
	});

	test("confirmCanvaManualShareComplete moves Canva action to completed", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {});
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.VOLUNTEER,
				memberIds: [userId],
			});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Comp",
				description: "",
				compStart: "2026-12-01",
				compEnd: "2026-12-02",
				organiserIds: [userId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId,
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-LINKED-CANVA",
				title: "Canva task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			const definitionId = await ctx.db.insert("linkedActionDefinitions", {
				name: "Certificates",
				shortId: "canva.cert",
				type: "canva_template",
				runPermission: "volunteer",
				config: {
					sourceBrandTemplateId: "DAG_bVVbgUM",
					destinationFolderId: "FAF-UVeKpXI",
					naming: {
						mode: "parent_plus_suffix",
						defaultSuffix: "Certificates",
					},
				},
				archived: false,
				createdById: userId,
				updatedById: userId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			const taskLinkedActionId = await ctx.db.insert("taskLinkedActions", {
				taskId,
				linkedActionId: definitionId,
				status: "awaiting_manual_share",
				lastOutputJson: JSON.stringify({
					designId: "DAG123",
					url: "https://www.canva.com/design/DAG123/edit",
					manualShareConfirmed: false,
				}),
				createdById: userId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			return { userId, taskId, taskLinkedActionId };
		});
		const authed = t.withIdentity({ subject: seeded.userId });

		await authed.mutation(api.linkedActions.confirmCanvaManualShareComplete, {
			taskId: seeded.taskId,
			taskLinkedActionId: seeded.taskLinkedActionId,
		});

		const row = await t.run((ctx) =>
			ctx.db.get("taskLinkedActions", seeded.taskLinkedActionId),
		);
		expect(row?.status).toBe("completed");
		expect(row?.lastRunMessage).toBeUndefined();
		const output = JSON.parse(row?.lastOutputJson ?? "{}");
		expect(output.manualShareConfirmed).toBe(true);
		expect(typeof output.manualShareConfirmedAt).toBe("number");
	});
});
