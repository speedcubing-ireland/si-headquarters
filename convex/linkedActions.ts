import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import {
	action,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { requireDirector } from "./admin";
import { isVolunteer, requireUserId } from "./auth";
import {
	linkedActionConfig,
	linkedActionRunPermission,
	linkedActionType,
	linkedTaskActionStatus,
} from "./lib/validators";
import {
	DEFAULT_RUN_PERMISSION_BY_TYPE,
	assertConfigMatchesType,
	assertShortId,
	canonicalizeConfigForType,
	normalizeRunPermissionForType,
} from "./linkedActions/config";
import {
	ensureTaskAccess,
	canUserRunForTask,
} from "./linkedActions/permissions";
import { runners } from "./linkedActions/runners";
import {
	definitionShape,
	linkedTaskActionShape,
	runContextShape,
	toDefinitionView,
} from "./linkedActions/shapes";

export const listDefinitions = query({
	args: {},
	returns: v.array(definitionShape),
	handler: async (ctx) => {
		await requireDirector(ctx);
		const rows = await ctx.db.query("linkedActionDefinitions").collect();
		return rows
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(toDefinitionView);
	},
});

export const listAvailableDefinitionsForTask = query({
	args: {
		taskId: v.id("tasks"),
	},
	returns: v.array(definitionShape),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		await ensureTaskAccess(ctx, userId, args.taskId, volunteer);

		const rows = await ctx.db
			.query("linkedActionDefinitions")
			.withIndex("by_archived", (q) => q.eq("archived", false))
			.collect();

		return rows
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(toDefinitionView);
	},
});

export const createDefinition = mutation({
	args: {
		name: v.string(),
		shortId: v.string(),
		type: linkedActionType,
		runPermission: v.optional(linkedActionRunPermission),
		config: linkedActionConfig,
	},
	returns: v.id("linkedActionDefinitions"),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const userId = await requireUserId(ctx);
		const shortId = args.shortId.trim();
		assertShortId(shortId);
		const config = canonicalizeConfigForType(args.type, args.config);
		assertConfigMatchesType(args.type, config);
		const runPermission = normalizeRunPermissionForType(
			args.type,
			args.runPermission ?? DEFAULT_RUN_PERMISSION_BY_TYPE[args.type],
		);

		const existing = await ctx.db
			.query("linkedActionDefinitions")
			.withIndex("by_short_id", (q) => q.eq("shortId", shortId))
			.first();
		if (existing) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Short ID already exists.",
			});
		}

		const now = Date.now();
		return await ctx.db.insert("linkedActionDefinitions", {
			name: args.name.trim(),
			shortId,
			type: args.type,
			runPermission,
			config,
			archived: false,
			createdById: userId,
			updatedById: userId,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const updateDefinition = mutation({
	args: {
		id: v.id("linkedActionDefinitions"),
		updates: v.object({
			name: v.optional(v.string()),
			shortId: v.optional(v.string()),
			type: v.optional(linkedActionType),
			runPermission: v.optional(linkedActionRunPermission),
			config: v.optional(linkedActionConfig),
			archived: v.optional(v.boolean()),
		}),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const userId = await requireUserId(ctx);
		const row = await ctx.db.get(args.id);
		if (!row) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Linked integration definition not found.",
			});
		}

		const type = args.updates.type ?? row.type;
		const config = canonicalizeConfigForType(
			type,
			args.updates.config ?? row.config,
		);
		assertConfigMatchesType(type, config);
		const nextRunPermission = normalizeRunPermissionForType(
			type,
			args.updates.runPermission ?? row.runPermission,
		);

		const patch: Partial<Doc<"linkedActionDefinitions">> & {
			updatedAt: number;
			updatedById: Id<"users">;
		} = {
			updatedAt: Date.now(),
			updatedById: userId,
		};

		if (args.updates.name !== undefined) {
			patch.name = args.updates.name.trim();
		}
		if (args.updates.shortId !== undefined) {
			const shortId = args.updates.shortId.trim();
			assertShortId(shortId);
			const existing = await ctx.db
				.query("linkedActionDefinitions")
				.withIndex("by_short_id", (q) => q.eq("shortId", shortId))
				.first();
			if (existing && existing._id !== row._id) {
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: "Short ID already exists.",
				});
			}
			patch.shortId = shortId;
		}
		if (args.updates.type !== undefined) patch.type = args.updates.type;
		if (
			args.updates.runPermission !== undefined ||
			(args.updates.type !== undefined &&
				nextRunPermission !== row.runPermission)
		) {
			patch.runPermission = nextRunPermission;
		}
		if (args.updates.config !== undefined) patch.config = config;
		if (args.updates.archived !== undefined)
			patch.archived = args.updates.archived;

		await ctx.db.patch(args.id, patch);
		return null;
	},
});

export const listForTask = query({
	args: {
		taskId: v.id("tasks"),
	},
	returns: v.array(linkedTaskActionShape),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		const task = await ensureTaskAccess(ctx, userId, args.taskId, volunteer);

		const rows = await ctx.db
			.query("taskLinkedActions")
			.withIndex("by_task", (q) => q.eq("taskId", args.taskId))
			.collect();

		const definitions = await Promise.all(
			rows.map((row) =>
				ctx.db.get("linkedActionDefinitions", row.linkedActionId),
			),
		);

		const rowsForUi = await Promise.all(
			rows.map(async (row, index) => {
				const definition = definitions[index];
				if (!definition) return null;
				const canRun = await canUserRunForTask(ctx, {
					userId,
					volunteer,
					task,
					actionType: definition.type,
					runPermission: definition.runPermission,
				});
				return {
					id: row._id,
					taskId: row.taskId,
					status: row.status,
					lastRunAt: row.lastRunAt ?? null,
					lastRunMessage: row.lastRunMessage ?? null,
					lastOutputJson: row.lastOutputJson ?? null,
					canRun,
					definition: toDefinitionView(definition),
				};
			}),
		);

		return rowsForUi
			.filter((row): row is Infer<typeof linkedTaskActionShape> => row !== null)
			.sort((a, b) => a.definition.name.localeCompare(b.definition.name));
	},
});

export const attachToTask = mutation({
	args: {
		taskId: v.id("tasks"),
		linkedActionId: v.id("linkedActionDefinitions"),
	},
	returns: v.id("taskLinkedActions"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		await ensureTaskAccess(ctx, userId, args.taskId, volunteer);

		const definition = await ctx.db.get(
			"linkedActionDefinitions",
			args.linkedActionId,
		);
		if (!definition || definition.archived) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Linked integration definition is unavailable.",
			});
		}

		const existing = await ctx.db
			.query("taskLinkedActions")
			.withIndex("by_task_and_linked_action", (q) =>
				q.eq("taskId", args.taskId).eq("linkedActionId", args.linkedActionId),
			)
			.first();

		if (existing) {
			return existing._id;
		}

		const now = Date.now();
		return await ctx.db.insert("taskLinkedActions", {
			taskId: args.taskId,
			linkedActionId: args.linkedActionId,
			status: "idle",
			createdById: userId,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const detachFromTask = mutation({
	args: {
		taskId: v.id("tasks"),
		taskLinkedActionId: v.id("taskLinkedActions"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		await ensureTaskAccess(ctx, userId, args.taskId, volunteer);

		const row = await ctx.db.get("taskLinkedActions", args.taskLinkedActionId);
		if (!row) return null;
		if (row.taskId !== args.taskId) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Linked integration row does not belong to task.",
			});
		}

		await ctx.db.delete("taskLinkedActions", row._id);
		return null;
	},
});

export const getTaskLinkedActionRunContext = internalQuery({
	args: {
		taskId: v.id("tasks"),
		taskLinkedActionId: v.id("taskLinkedActions"),
	},
	returns: runContextShape,
	handler: async (ctx, args) => {
		const row = await ctx.db.get("taskLinkedActions", args.taskLinkedActionId);
		if (!row || row.taskId !== args.taskId) return null;

		const [task, definition] = await Promise.all([
			ctx.db.get("tasks", row.taskId),
			ctx.db.get("linkedActionDefinitions", row.linkedActionId),
		]);
		if (!task || !definition) return null;

		const competitionName = task.parentCompetitionId
			? ((await ctx.db.get("competitions", task.parentCompetitionId))?.name ??
				null)
			: null;

		return {
			taskLinkedActionId: row._id,
			task: {
				id: task._id,
				title: task.title,
				parentCompetitionId: task.parentCompetitionId ?? null,
			},
			competitionName,
			definition: toDefinitionView(definition),
		};
	},
});

export const canUserRunTaskLinkedAction = internalQuery({
	args: {
		taskId: v.id("tasks"),
		taskLinkedActionId: v.id("taskLinkedActions"),
		userId: v.id("users"),
		volunteer: v.boolean(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const row = await ctx.db.get("taskLinkedActions", args.taskLinkedActionId);
		if (!row || row.taskId !== args.taskId) return false;

		const [task, definition] = await Promise.all([
			ctx.db.get("tasks", args.taskId),
			ctx.db.get("linkedActionDefinitions", row.linkedActionId),
		]);
		if (!task || !definition || definition.archived) return false;

		return canUserRunForTask(ctx, {
			userId: args.userId,
			volunteer: args.volunteer,
			task,
			actionType: definition.type,
			runPermission: definition.runPermission,
		});
	},
});

export const setTaskLinkedActionRunState = internalMutation({
	args: {
		taskLinkedActionId: v.id("taskLinkedActions"),
		status: linkedTaskActionStatus,
		lastRunAt: v.optional(v.number()),
		lastRunMessage: v.optional(v.string()),
		lastOutputJson: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const row = await ctx.db.get("taskLinkedActions", args.taskLinkedActionId);
		if (!row) return null;
		await ctx.db.patch("taskLinkedActions", row._id, {
			status: args.status,
			lastRunAt: args.lastRunAt,
			lastRunMessage: args.lastRunMessage,
			lastOutputJson: args.lastOutputJson,
			updatedAt: Date.now(),
		});
		return null;
	},
});

function parseOutputObject(
	value: string | undefined,
): Record<string, unknown> | null {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value) as unknown;
		if (typeof parsed === "object" && parsed !== null) {
			return parsed as Record<string, unknown>;
		}
		return null;
	} catch {
		return null;
	}
}

export const confirmCanvaManualShareComplete = mutation({
	args: {
		taskId: v.id("tasks"),
		taskLinkedActionId: v.id("taskLinkedActions"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		const task = await ensureTaskAccess(ctx, userId, args.taskId, volunteer);
		const row = await ctx.db.get("taskLinkedActions", args.taskLinkedActionId);
		if (!row || row.taskId !== args.taskId) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Linked integration row not found for task.",
			});
		}
		const definition = await ctx.db.get(
			"linkedActionDefinitions",
			row.linkedActionId,
		);
		if (!definition || definition.archived) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Linked integration definition is unavailable.",
			});
		}
		const canRun = await canUserRunForTask(ctx, {
			userId,
			volunteer,
			task,
			actionType: definition.type,
			runPermission: definition.runPermission,
		});
		if (!canRun) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You do not have permission to confirm this action.",
			});
		}
		if (definition.type !== "canva_template") {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message:
					"Manual share confirmation is only available for Canva actions.",
			});
		}
		if (row.status === "running") {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Action is still running.",
			});
		}
		if (row.status === "idle" || row.status === "error") {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Run the Canva action before confirming sharing.",
			});
		}
		if (row.status === "completed") {
			return null;
		}

		const now = Date.now();
		const output = parseOutputObject(row.lastOutputJson) ?? {};
		const nextOutput = JSON.stringify({
			...output,
			manualShareConfirmed: true,
			manualShareConfirmedAt: now,
		});

		await ctx.db.patch("taskLinkedActions", row._id, {
			status: "completed",
			lastRunAt: now,
			lastOutputJson: nextOutput,
			updatedAt: now,
		});
		return null;
	},
});

export const linkTaskCanvaDesign = action({
	args: {
		taskId: v.id("tasks"),
		taskLinkedActionId: v.id("taskLinkedActions"),
		designInput: v.string(),
	},
	returns: v.union(
		v.object({
			success: v.literal(true),
			message: v.string(),
		}),
		v.object({
			success: v.literal(false),
			message: v.string(),
		}),
	),
	handler: async (ctx, args): Promise<RunTaskLinkedActionResult> => {
		const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
		if (!currentUser) {
			return { success: false as const, message: "Authentication required." };
		}
		const volunteer = await ctx.runQuery(api.auth.isVolunteerQuery, {});
		const task = await ctx.runQuery(api.tasks.get, {
			taskId: args.taskId,
		});
		if (!task) {
			return { success: false as const, message: "Task not found." };
		}

		const runContext: Infer<typeof runContextShape> = await ctx.runQuery(
			internal.linkedActions.getTaskLinkedActionRunContext,
			{
				taskId: args.taskId,
				taskLinkedActionId: args.taskLinkedActionId,
			},
		);
		if (!runContext || runContext.definition.archived) {
			return {
				success: false as const,
				message: "Linked integration is unavailable.",
			};
		}
		if (runContext.definition.type !== "canva_template") {
			return {
				success: false as const,
				message: "Manual design linking is only supported for Canva actions.",
			};
		}

		const canRun = await ctx.runQuery(
			internal.linkedActions.canUserRunTaskLinkedAction,
			{
				taskId: args.taskId,
				taskLinkedActionId: args.taskLinkedActionId,
				userId: currentUser._id,
				volunteer,
			},
		);
		if (!canRun) {
			return {
				success: false as const,
				message: "You do not have permission to run this linked integration.",
			};
		}

		try {
			const design = await ctx.runAction(api.canva.validateDesignInput, {
				value: args.designInput,
				taskId: args.taskId,
				taskLinkedActionId: args.taskLinkedActionId,
			});

			const nextOutput = JSON.stringify({
				designId: design.id,
				title: design.title,
				url: design.url,
				previewImageUrl: design.previewImageUrl,
				requiresManualShareConfirmation: true,
				manualShareConfirmed: false,
				manualLink: true,
			});

			await ctx.runMutation(
				internal.linkedActions.setTaskLinkedActionRunState,
				{
					taskLinkedActionId: runContext.taskLinkedActionId,
					status: "awaiting_manual_share",
					lastRunAt: Date.now(),
					lastRunMessage: "Canva design linked manually.",
					lastOutputJson: nextOutput,
				},
			);
			return {
				success: true as const,
				message: "Canva design linked. Confirm sharing when ready.",
			};
		} catch (error) {
			const message =
				error instanceof ConvexError
					? ((error.data?.message as string | undefined) ??
						"Could not validate Canva design.")
					: error instanceof Error
						? error.message
						: "Could not validate Canva design.";
			return {
				success: false as const,
				message,
			};
		}
	},
});

type RunTaskLinkedActionResult =
	| {
			success: true;
			message: string;
	  }
	| {
			success: false;
			message: string;
	  };

export const runTaskLinkedAction = action({
	args: {
		taskId: v.id("tasks"),
		taskLinkedActionId: v.id("taskLinkedActions"),
		nameInput: v.optional(v.string()),
	},
	returns: v.union(
		v.object({
			success: v.literal(true),
			message: v.string(),
		}),
		v.object({
			success: v.literal(false),
			message: v.string(),
		}),
	),
	handler: async (ctx, args): Promise<RunTaskLinkedActionResult> => {
		const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
		if (!currentUser) {
			return { success: false as const, message: "Authentication required." };
		}
		const volunteer = await ctx.runQuery(api.auth.isVolunteerQuery, {});
		const task = await ctx.runQuery(api.tasks.get, {
			taskId: args.taskId,
		});
		if (!task) {
			return { success: false as const, message: "Task not found." };
		}

		const runContext: Infer<typeof runContextShape> = await ctx.runQuery(
			internal.linkedActions.getTaskLinkedActionRunContext,
			{
				taskId: args.taskId,
				taskLinkedActionId: args.taskLinkedActionId,
			},
		);
		if (!runContext || runContext.definition.archived) {
			return {
				success: false as const,
				message: "Linked integration is unavailable.",
			};
		}
		const canRun = await ctx.runQuery(
			internal.linkedActions.canUserRunTaskLinkedAction,
			{
				taskId: args.taskId,
				taskLinkedActionId: args.taskLinkedActionId,
				userId: currentUser._id,
				volunteer,
			},
		);
		if (!canRun) {
			return {
				success: false as const,
				message: "You do not have permission to run this linked integration.",
			};
		}

		await ctx.runMutation(internal.linkedActions.setTaskLinkedActionRunState, {
			taskLinkedActionId: runContext.taskLinkedActionId,
			status: "running",
			lastRunAt: Date.now(),
			lastRunMessage: "Running...",
		});

		try {
			const runner = runners[runContext.definition.type];
			const result = await runner(ctx, runContext, {
				nameInput: args.nameInput,
			});
			const nextStatus =
				runContext.definition.type === "canva_template"
					? "awaiting_manual_share"
					: "completed";

			await ctx.runMutation(
				internal.linkedActions.setTaskLinkedActionRunState,
				{
					taskLinkedActionId: runContext.taskLinkedActionId,
					status: nextStatus,
					lastRunAt: Date.now(),
					lastRunMessage: result.message,
					lastOutputJson: result.outputJson,
				},
			);

			return {
				success: true as const,
				message: result.message,
			};
		} catch (error) {
			const message =
				error instanceof ConvexError
					? ((error.data?.message as string | undefined) ??
						"Action run failed.")
					: error instanceof Error
						? error.message
						: "Action run failed.";
			await ctx.runMutation(
				internal.linkedActions.setTaskLinkedActionRunState,
				{
					taskLinkedActionId: runContext.taskLinkedActionId,
					status: "error",
					lastRunAt: Date.now(),
					lastRunMessage: message,
				},
			);
			return {
				success: false as const,
				message,
			};
		}
	},
});
