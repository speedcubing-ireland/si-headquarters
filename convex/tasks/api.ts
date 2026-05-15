import { v, ConvexError, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { requireUserId, isVolunteer } from "../auth";
import { isDirectorForCtx } from "../admin";
import {
	collectAllTaskIdsRecursively,
	deleteTasksAndRelatedData,
} from "./deletion";
import {
	ERROR_TASK_MOVE,
	ERROR_TASK_NO_ACCESS,
	hasTaskCompetitionAccess,
	hasTaskWriteAccess,
	hasStandaloneTaskAccess,
	listOrganisedCompetitionIds,
	requireCompetitionTaskAccess,
	requireTaskAccess,
} from "./access";
import {
	encodeApprovalId,
	computeApprovalCompleteness,
	scheduleAwaitingReviewNotifications,
} from "./approvalLogic";
import { formatCompetitionName } from "./format";

import {
	sendTaskAssigneeChangeNotifications,
	sendTaskApprovalNotifications,
	sendTaskUnapprovalNotifications,
	sendDueDateChangeNotifications,
	sendTaskPriorityChangeNotifications,
	sendTaskRelationBlockedNotifications,
	sendTaskRelationUnblockedNotifications,
	sendTaskStatusChangeNotifications,
} from "../notifications/triggers/tasks";
import {
	buildTaskPatch,
	applyAwaitingReviewAutoPromote,
	taskUpdateArgs,
} from "./patch";
import type { TaskUpdate } from "./patch";
import {
	taskStatus,
	taskPriority,
	approvalShape,
	linkedResource,
	userShape as sharedUserShape,
	teamShape,
	labelShape as taskLabelShape,
	phaseShape,
} from "../lib/validators";
import { MAX_BULK_UPDATE_COUNT } from "../lib/constants";
import {
	buildTaskRelationDataMap,
	countUnresolvedBlockers,
	wouldCreateTaskRelationCycle,
	computeBlockingStatusTransitionEffects,
	type TaskRelationTransitionEffect,
	isTaskBlockingStatus,
	EMPTY_TASK_RELATION_DATA,
} from "./relationsLogic";
import { hydrateTaskEntities } from "./hydration";
import {
	filterAccessibleSubtasks,
	transformTaskToUI,
	resolveTaskParent,
} from "./transforms";
import { emitNotificationEvent } from "../notifications";
import { maybeTriggerDueDateCheckForToday } from "./dueDate";
import {
	assertValidApprovalIds,
	nextTaskIdentifier,
	reserveTaskIdentifiers,
} from "./creation";

interface FetchAccessibleTasksOptions {
	archived: boolean;
	competitionId?: Id<"competitions">;
}

interface FetchAccessibleTasksResult {
	tasks: Doc<"tasks">[];
	accessibleCompetitionIds: Set<Id<"competitions">>;
}

async function fetchAccessibleTasks(
	ctx: QueryCtx,
	userId: Id<"users">,
	volunteer: boolean,
	opts: FetchAccessibleTasksOptions,
): Promise<FetchAccessibleTasksResult> {
	const { archived, competitionId } = opts;
	const accessibleCompetitionIds = new Set<Id<"competitions">>();

	if (competitionId) {
		if (!volunteer) {
			const hasAccess = await hasTaskCompetitionAccess(
				ctx,
				volunteer,
				userId,
				competitionId,
			);
			if (!hasAccess) {
				return { tasks: [], accessibleCompetitionIds };
			}
			accessibleCompetitionIds.add(competitionId);
		}
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_parent_competition_and_archived", (q) =>
				q.eq("parentCompetitionId", competitionId).eq("archived", archived),
			)
			.order("desc")
			.collect();
		return { tasks, accessibleCompetitionIds };
	}

	if (volunteer) {
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_archived", (q) => q.eq("archived", archived))
			.order("desc")
			.collect();
		return { tasks, accessibleCompetitionIds };
	}

	const organisedCompetitionIds = await listOrganisedCompetitionIds(
		ctx,
		userId,
	);
	for (const id of organisedCompetitionIds) {
		accessibleCompetitionIds.add(id);
	}

	const taskGroups = await Promise.all(
		organisedCompetitionIds.map((id) =>
			ctx.db
				.query("tasks")
				.withIndex("by_parent_competition_and_archived", (q) =>
					q.eq("parentCompetitionId", id).eq("archived", archived),
				)
				.order("desc")
				.collect(),
		),
	);
	const standaloneTasks = await ctx.db
		.query("tasks")
		.withIndex("by_assignee", (q) => q.eq("assigneeId", userId))
		.collect();

	const taskMap = new Map<Id<"tasks">, Doc<"tasks">>();
	for (const taskGroup of taskGroups) {
		for (const task of taskGroup) {
			taskMap.set(task._id, task);
		}
	}
	for (const task of standaloneTasks) {
		if (task.archived !== archived) continue;
		if (!hasStandaloneTaskAccess(task, userId)) continue;
		taskMap.set(task._id, task);
	}

	const tasks = [...taskMap.values()].sort(
		(a, b) => b._creationTime - a._creationTime,
	);

	return { tasks, accessibleCompetitionIds };
}

const taskDoc = v.object({
	_id: v.id("tasks"),
	_creationTime: v.number(),
	identifier: v.string(),
	title: v.string(),
	description: v.string(),
	status: taskStatus,
	priority: taskPriority,
	dueDate: v.optional(v.string()),
	archived: v.boolean(),
	archivedAt: v.optional(v.string()),
	parentTaskId: v.optional(v.id("tasks")),
	parentCompetitionId: v.optional(v.id("competitions")),
	ownerId: v.optional(v.union(v.id("users"), v.id("teams"))),
	ownerType: v.optional(v.union(v.literal("user"), v.literal("team"))),
	assigneeId: v.optional(v.id("users")),
	phaseId: v.optional(v.id("phases")),
	labelIds: v.array(v.id("labels")),
	requiredApprovalIds: v.optional(v.array(v.string())),
	approvedByIds: v.optional(v.array(v.id("users"))),
	resources: v.optional(
		v.array(
			v.union(
				v.object({ type: v.literal("google-sheet"), sheetId: v.string() }),
				v.object({ type: v.literal("canva-design"), designId: v.string() }),
			),
		),
	),
	updatedAt: v.number(),
});

export const list = query({
	args: {
		archived: v.optional(v.boolean()),
	},
	returns: v.array(taskDoc),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		const archived = args.archived ?? false;

		const { tasks } = await fetchAccessibleTasks(ctx, userId, volunteer, {
			archived,
		});
		return tasks;
	},
});

export const get = query({
	args: { taskId: v.id("tasks") },
	returns: v.union(taskDoc, v.null()),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task) return null;

		const volunteer = await isVolunteer(ctx);
		if (volunteer) {
			return task;
		}

		if (!task.parentCompetitionId) {
			return hasStandaloneTaskAccess(task, userId) ? task : null;
		}

		const hasAccess = await hasTaskCompetitionAccess(
			ctx,
			volunteer,
			userId,
			task.parentCompetitionId,
		);
		return hasAccess ? task : null;
	},
});

export const userShape = sharedUserShape;

const parentShape = v.union(
	v.null(),
	v.object({
		type: v.literal("task"),
		linkedId: v.id("tasks"),
	}),
	v.object({
		type: v.literal("competition"),
		linkedId: v.id("competitions"),
	}),
);

const subtaskMinimalShape = v.object({
	id: v.id("tasks"),
	title: v.string(),
	status: taskStatus,
});

const relationTaskShape = v.object({
	id: v.id("tasks"),
	identifier: v.string(),
	title: v.string(),
	status: taskStatus,
});

const blockedByRelationShape = v.object({
	task: relationTaskShape,
	isResolved: v.boolean(),
});

export const taskForUIReturns = v.object({
	id: v.id("tasks"),
	identifier: v.string(),
	parent: parentShape,
	parentDisplayName: v.union(v.string(), v.null()),
	competitionDisplayName: v.union(v.string(), v.null()),
	title: v.string(),
	description: v.string(),
	owner: v.union(v.null(), userShape, teamShape),
	assignee: v.union(v.null(), userShape),
	phase: v.union(v.null(), phaseShape),
	status: taskStatus,
	priority: taskPriority,
	dueDate: v.union(v.string(), v.null()),
	requiredApprovalBy: v.array(approvalShape),
	approvedBy: v.array(userShape),
	labels: v.array(taskLabelShape),
	blockedBy: v.array(blockedByRelationShape),
	blocks: v.array(relationTaskShape),
	unresolvedBlockerCount: v.number(),
	isBlocked: v.boolean(),
	canEdit: v.boolean(),
	resources: v.array(linkedResource),
	subTasks: v.array(subtaskMinimalShape),
	createdAt: v.string(),
	updatedAt: v.string(),
	archivedAt: v.union(v.string(), v.null()),
});

export const listForUI = query({
	args: {
		archived: v.optional(v.boolean()),
		competitionId: v.optional(v.id("competitions")),
	},
	returns: v.array(taskForUIReturns),
	handler: async (
		ctx,
		args,
	): Promise<Array<Infer<typeof taskForUIReturns>>> => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		const archived = args.archived ?? false;

		const { tasks, accessibleCompetitionIds } = await fetchAccessibleTasks(
			ctx,
			userId,
			volunteer,
			{ archived, competitionId: args.competitionId },
		);

		if (tasks.length === 0) return [];

		const [relationDataByTask, maps] = await Promise.all([
			buildTaskRelationDataMap(
				ctx,
				tasks.map((task) => task._id),
			),
			hydrateTaskEntities(ctx, tasks),
		]);

		const subtaskRowsByParent = new Map<
			Id<"tasks">,
			Array<{ id: Id<"tasks">; title: string; status: Doc<"tasks">["status"] }>
		>();
		await Promise.all(
			tasks.map(async (task) => {
				const children = await ctx.db
					.query("tasks")
					.withIndex("by_parent_task", (q) => q.eq("parentTaskId", task._id))
					.collect();
				const filtered = filterAccessibleSubtasks(children, {
					archived,
					volunteer,
					userId,
					accessibleCompetitionIds,
				});
				subtaskRowsByParent.set(task._id, filtered);
			}),
		);

		return tasks.map((t) => {
			const canEdit =
				volunteer ||
				(!t.parentCompetitionId
					? hasStandaloneTaskAccess(t, userId)
					: accessibleCompetitionIds.has(t.parentCompetitionId));

			return {
				...transformTaskToUI(ctx, t, {
					maps,
					subTasks: subtaskRowsByParent.get(t._id) ?? [],
					relationData:
						relationDataByTask.get(t._id) ?? EMPTY_TASK_RELATION_DATA,
				}),
				canEdit,
			};
		});
	},
});

export const getForUI = query({
	args: { taskId: v.id("tasks") },
	returns: v.union(taskForUIReturns, v.null()),
	handler: async (
		ctx,
		args,
	): Promise<Infer<typeof taskForUIReturns> | null> => {
		const userId = await requireUserId(ctx);
		const t = await ctx.db.get("tasks", args.taskId);
		if (!t) return null;

		const volunteer = await isVolunteer(ctx);
		const canEdit = await hasTaskWriteAccess(ctx, volunteer, userId, t);
		if (!canEdit) {
			return null;
		}
		const canEditForUi: boolean = canEdit;

		const [relationDataByTask, maps, childTasks] = await Promise.all([
			buildTaskRelationDataMap(ctx, [args.taskId]),
			hydrateTaskEntities(ctx, [t]),
			ctx.db
				.query("tasks")
				.withIndex("by_parent_task", (q) => q.eq("parentTaskId", args.taskId))
				.collect(),
		]);

		const subTasks = filterAccessibleSubtasks(childTasks, {
			archived: t.archived,
			volunteer,
			userId,
			parentTaskCompetitionId: t.parentCompetitionId,
		});

		const parent = resolveTaskParent(t);
		let parentDisplayName: string | null = null;
		if (parent) {
			if (parent.type === "task") {
				const parentTask = await ctx.db.get("tasks", parent.linkedId);
				if (parentTask) {
					if (volunteer) {
						parentDisplayName = parentTask.title;
					} else if (!parentTask.parentCompetitionId) {
						parentDisplayName = hasStandaloneTaskAccess(parentTask, userId)
							? parentTask.title
							: null;
					} else {
						const sameCompetition =
							parentTask.parentCompetitionId === t.parentCompetitionId;
						parentDisplayName = sameCompetition ? parentTask.title : null;
					}
				}
			} else {
				const comp = await ctx.db.get("competitions", parent.linkedId);
				parentDisplayName = comp ? formatCompetitionName(comp.name) : null;
			}
		}

		return {
			...transformTaskToUI(ctx, t, {
				maps,
				subTasks,
				relationData:
					relationDataByTask.get(args.taskId) ?? EMPTY_TASK_RELATION_DATA,
				parentDisplayNameOverride: parentDisplayName,
			}),
			canEdit: canEditForUi,
		};
	},
});

const taskCreateArgs = {
	title: v.string(),
	description: v.optional(v.string()),
	status: taskStatus,
	priority: taskPriority,
	dueDate: v.optional(v.string()),
	parentTaskId: v.optional(v.id("tasks")),
	parentCompetitionId: v.optional(v.id("competitions")),
	ownerId: v.optional(v.union(v.id("users"), v.id("teams"))),
	ownerType: v.optional(v.union(v.literal("user"), v.literal("team"))),
	assigneeId: v.optional(v.id("users")),
	phaseId: v.optional(v.id("phases")),
	labelIds: v.optional(v.array(v.id("labels"))),
	requiredApprovalIds: v.optional(v.array(v.string())),
};

const templateTaskCreateArgs = v.object({
	tempId: v.string(),
	parentTempId: v.optional(v.string()),
	title: v.string(),
	description: v.optional(v.string()),
	status: taskStatus,
	priority: taskPriority,
	dueDate: v.optional(v.string()),
	ownerId: v.optional(v.union(v.id("users"), v.id("teams"))),
	ownerType: v.optional(v.union(v.literal("user"), v.literal("team"))),
	assigneeId: v.optional(v.id("users")),
	phaseId: v.optional(v.id("phases")),
	labelIds: v.array(v.id("labels")),
	requiredApprovalIds: v.optional(v.array(v.string())),
	linkedActionShortIds: v.optional(v.array(v.string())),
});

const ERROR_TASK_RELATION_SELF = "A task cannot block itself";
const ERROR_TASK_RELATION_SCOPE =
	"Tasks can only block tasks within the same competition";
const ERROR_TASK_RELATION_CYCLE =
	"This dependency would create a blocking cycle";

type TaskPatchForUpdate = ReturnType<typeof buildTaskPatch>;

async function ensureTaskMoveAccess(
	ctx: MutationCtx,
	volunteer: boolean,
	userId: Id<"users">,
	parentCompetitionId: Id<"competitions"> | null | undefined,
): Promise<void> {
	if (parentCompetitionId === undefined || parentCompetitionId === null) {
		return;
	}
	await requireCompetitionTaskAccess(ctx, {
		volunteer,
		userId,
		competitionId: parentCompetitionId,
		forbiddenMessage: ERROR_TASK_MOVE,
	});
}

async function buildPreparedTaskPatch(
	ctx: MutationCtx,
	doc: Doc<"tasks">,
	updates: TaskUpdate,
	updatedAt: number,
): Promise<TaskPatchForUpdate> {
	const patch = buildTaskPatch(updates, updatedAt);
	await applyAwaitingReviewAutoPromote(ctx, doc, patch);
	return patch;
}

function resolveUpdatedAssigneeId(
	doc: Doc<"tasks">,
	updates: TaskUpdate,
): Id<"users"> | undefined {
	if (updates.assigneeId === undefined) {
		return doc.assigneeId;
	}
	return updates.assigneeId ?? undefined;
}

function resolveUpdatedStatus(
	doc: Doc<"tasks">,
	updates: TaskUpdate,
	patch: TaskPatchForUpdate,
): Doc<"tasks">["status"] {
	return patch.status ?? updates.status ?? doc.status;
}

function resolveUpdatedPriority(
	doc: Doc<"tasks">,
	updates: TaskUpdate,
	patch: TaskPatchForUpdate,
): Doc<"tasks">["priority"] {
	return patch.priority ?? updates.priority ?? doc.priority;
}

async function runTaskUpdateSideEffects(
	ctx: MutationCtx,
	args: {
		taskId: Id<"tasks">;
		userId: Id<"users">;
		doc: Doc<"tasks">;
		updates: TaskUpdate;
		patch: TaskPatchForUpdate;
	},
): Promise<void> {
	const { taskId, userId, doc, updates, patch } = args;
	const oldAssigneeId = doc.assigneeId;
	const newAssigneeId = resolveUpdatedAssigneeId(doc, updates);
	const oldStatus = doc.status;
	const newStatus = resolveUpdatedStatus(doc, updates, patch);
	const oldPriority = doc.priority;
	const newPriority = resolveUpdatedPriority(doc, updates, patch);

	if (oldAssigneeId !== newAssigneeId) {
		await sendTaskAssigneeChangeNotifications(
			ctx,
			taskId,
			oldAssigneeId,
			newAssigneeId,
			userId,
		);
	}

	if (updates.status !== undefined && oldStatus !== newStatus) {
		await sendTaskStatusChangeNotifications(
			ctx,
			taskId,
			doc,
			oldStatus,
			newStatus,
			userId,
		);
		const relationEffects = await computeBlockingStatusTransitionEffects(
			ctx,
			taskId,
			oldStatus,
			newStatus,
		);
		await emitTaskRelationTransitionNotifications(ctx, relationEffects, userId);
	}

	if (updates.priority !== undefined && oldPriority !== newPriority) {
		await sendTaskPriorityChangeNotifications(
			ctx,
			taskId,
			doc,
			oldPriority,
			newPriority,
			userId,
		);
	}

	if (updates.dueDate !== undefined) {
		const oldDueDate = doc.dueDate;
		const newDueDate = updates.dueDate === null ? undefined : updates.dueDate;
		if (oldDueDate !== newDueDate) {
			await sendDueDateChangeNotifications(
				ctx,
				taskId,
				doc,
				oldDueDate,
				newDueDate,
				userId,
			);
			await maybeTriggerDueDateCheckForToday(ctx, {
				taskId,
				dueDate: newDueDate,
				assigneeId: newAssigneeId,
				status: newStatus,
			});
		}
	}

	if (newStatus === "awaiting-review") {
		await scheduleAwaitingReviewNotifications(
			ctx,
			taskId,
			doc.requiredApprovalIds,
			userId,
		);
	}
}

async function emitTaskRelationTransitionNotifications(
	ctx: MutationCtx,
	effects: TaskRelationTransitionEffect[],
	actorId: Id<"users">,
): Promise<void> {
	await Promise.all(
		effects.map((effect) => {
			if (effect.type === "blocked") {
				return sendTaskRelationBlockedNotifications(
					ctx,
					effect.blockedTaskId,
					effect.blockingTaskId,
					actorId,
				);
			}
			return sendTaskRelationUnblockedNotifications(
				ctx,
				effect.blockedTaskId,
				effect.blockingTaskId,
				actorId,
			);
		}),
	);
}

export const create = mutation({
	args: taskCreateArgs,
	returns: v.id("tasks"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);

		if (!args.title.trim()) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Task title is required",
			});
		}

		const isStandaloneTask = args.parentCompetitionId === undefined;

		if (args.parentCompetitionId) {
			await requireCompetitionTaskAccess(ctx, {
				volunteer,
				userId,
				competitionId: args.parentCompetitionId,
				forbiddenMessage: ERROR_TASK_NO_ACCESS,
			});
		}

		const now = Date.now();
		const identifier = await nextTaskIdentifier(ctx);
		const ownerId =
			!volunteer && isStandaloneTask ? userId : (args.ownerId ?? undefined);
		const ownerType =
			!volunteer && isStandaloneTask
				? ("user" as const)
				: (args.ownerType ?? undefined);
		const assigneeId =
			!volunteer && isStandaloneTask
				? (args.assigneeId ?? userId)
				: args.assigneeId;

		const approvalIds = args.requiredApprovalIds ?? [];
		assertValidApprovalIds(approvalIds);

		const taskId = await ctx.db.insert("tasks", {
			identifier,
			title: args.title,
			description: args.description ?? "",
			status: args.status,
			priority: args.priority,
			dueDate: args.dueDate,
			archived: false,
			parentTaskId: args.parentTaskId,
			parentCompetitionId: args.parentCompetitionId,
			ownerId,
			ownerType,
			assigneeId,
			phaseId: args.phaseId,
			labelIds: args.labelIds ?? [],
			requiredApprovalIds: approvalIds,
			updatedAt: now,
		});

		if (assigneeId && assigneeId !== userId) {
			await emitNotificationEvent(ctx, {
				type: "task_assigned",
				taskId,
				recipientId: assigneeId,
				actorId: userId,
			});
		}
		await maybeTriggerDueDateCheckForToday(ctx, {
			taskId,
			dueDate: args.dueDate,
			assigneeId,
			status: args.status,
		});

		return taskId;
	},
});

export const createManyFromTemplate = mutation({
	args: {
		competitionId: v.id("competitions"),
		tasks: v.array(templateTaskCreateArgs),
	},
	returns: v.object({
		taskIds: v.array(v.id("tasks")),
		missingLinkedActionShortIds: v.array(v.string()),
	}),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		await requireCompetitionTaskAccess(ctx, {
			volunteer,
			userId,
			competitionId: args.competitionId,
			forbiddenMessage: ERROR_TASK_NO_ACCESS,
		});

		if (args.tasks.length === 0) {
			return {
				taskIds: [],
				missingLinkedActionShortIds: [],
			};
		}

		const identifiers = await reserveTaskIdentifiers(ctx, args.tasks.length);
		const tempIdToTaskId = new Map<string, Id<"tasks">>();
		const createdTaskIds: Id<"tasks">[] = [];
		const now = Date.now();
		const requestedShortIds = [
			...new Set(args.tasks.flatMap((task) => task.linkedActionShortIds ?? [])),
		];
		const linkedActionIdByShortId = new Map<
			string,
			Id<"linkedActionDefinitions">
		>();
		const missingLinkedActionShortIds: string[] = [];

		for (const shortId of requestedShortIds) {
			const definition = await ctx.db
				.query("linkedActionDefinitions")
				.withIndex("by_short_id", (q) => q.eq("shortId", shortId))
				.first();
			if (!definition || definition.archived) {
				missingLinkedActionShortIds.push(shortId);
				continue;
			}
			linkedActionIdByShortId.set(shortId, definition._id);
		}

		for (const [index, task] of args.tasks.entries()) {
			if (!task.title.trim()) {
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: `Task title is required for tempId ${task.tempId}`,
				});
			}

			const parentTaskId = task.parentTempId
				? tempIdToTaskId.get(task.parentTempId)
				: undefined;
			if (task.parentTempId && !parentTaskId) {
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: `Missing parent task for tempId ${task.tempId}`,
				});
			}

			const approvalIds = task.requiredApprovalIds ?? [];
			assertValidApprovalIds(approvalIds);

			const taskId = await ctx.db.insert("tasks", {
				identifier: identifiers[index],
				title: task.title,
				description: task.description ?? "",
				status: task.status,
				priority: task.priority,
				dueDate: task.dueDate,
				archived: false,
				parentTaskId,
				parentCompetitionId: args.competitionId,
				ownerId: task.ownerId,
				ownerType: task.ownerType,
				assigneeId: task.assigneeId,
				phaseId: task.phaseId,
				labelIds: task.labelIds,
				requiredApprovalIds: approvalIds,
				updatedAt: now,
			});

			const linkedActionIds = [
				...new Set(
					(task.linkedActionShortIds ?? [])
						.map((shortId) => linkedActionIdByShortId.get(shortId))
						.filter(
							(id): id is Id<"linkedActionDefinitions"> => id !== undefined,
						),
				),
			];
			for (const linkedActionId of linkedActionIds) {
				await ctx.db.insert("taskLinkedActions", {
					taskId,
					linkedActionId,
					status: "idle",
					createdById: userId,
					createdAt: now,
					updatedAt: now,
				});
			}

			tempIdToTaskId.set(task.tempId, taskId);
			createdTaskIds.push(taskId);

			if (task.assigneeId && task.assigneeId !== userId) {
				await emitNotificationEvent(ctx, {
					type: "task_assigned",
					taskId,
					recipientId: task.assigneeId,
					actorId: userId,
				});
			}
			await maybeTriggerDueDateCheckForToday(ctx, {
				taskId,
				dueDate: task.dueDate,
				assigneeId: task.assigneeId,
				status: task.status,
			});
		}

		return {
			taskIds: createdTaskIds,
			missingLinkedActionShortIds,
		};
	},
});

export const update = mutation({
	args: {
		taskId: v.id("tasks"),
		updates: v.object(taskUpdateArgs),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("tasks", args.taskId);
		if (!doc) return null;

		const volunteer = await isVolunteer(ctx);
		await requireTaskAccess(ctx, volunteer, userId, doc);
		await ensureTaskMoveAccess(
			ctx,
			volunteer,
			userId,
			args.updates.parentCompetitionId,
		);

		const patch = await buildPreparedTaskPatch(
			ctx,
			doc,
			args.updates,
			Date.now(),
		);

		await ctx.db.patch("tasks", args.taskId, patch);
		await runTaskUpdateSideEffects(ctx, {
			taskId: args.taskId,
			userId,
			doc,
			updates: args.updates,
			patch,
		});

		return null;
	},
});

export const bulkUpdate = mutation({
	args: {
		taskIds: v.array(v.id("tasks")),
		updates: v.object(taskUpdateArgs),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		if (args.taskIds.length === 0) {
			return null;
		}

		if (args.taskIds.length > MAX_BULK_UPDATE_COUNT) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: `Cannot bulk update more than ${MAX_BULK_UPDATE_COUNT} tasks at once`,
			});
		}

		const taskDocs = await Promise.all(
			args.taskIds.map((id) => ctx.db.get("tasks", id)),
		);
		const taskMap = new Map<Id<"tasks">, Doc<"tasks">>();
		for (let i = 0; i < args.taskIds.length; i++) {
			const doc = taskDocs[i];
			if (doc) taskMap.set(args.taskIds[i], doc);
		}

		for (const taskId of args.taskIds) {
			const doc = taskMap.get(taskId);
			if (!doc) continue;

			await requireTaskAccess(ctx, volunteer, userId, doc);
		}
		await ensureTaskMoveAccess(
			ctx,
			volunteer,
			userId,
			args.updates.parentCompetitionId,
		);

		const now = Date.now();

		for (const taskId of args.taskIds) {
			const doc = taskMap.get(taskId);
			if (!doc) continue;

			const patch = await buildPreparedTaskPatch(ctx, doc, args.updates, now);

			await ctx.db.patch("tasks", taskId, patch);
			await runTaskUpdateSideEffects(ctx, {
				taskId,
				userId,
				doc,
				updates: args.updates,
				patch,
			});
		}

		return null;
	},
});

function findTaskRelation(
	ctx: MutationCtx,
	blockedTaskId: Id<"tasks">,
	blockingTaskId: Id<"tasks">,
) {
	return ctx.db
		.query("taskRelations")
		.withIndex("by_blocked_and_blocking", (q) =>
			q.eq("blockedTaskId", blockedTaskId).eq("blockingTaskId", blockingTaskId),
		)
		.first();
}

export const addBlockingRelation = mutation({
	args: {
		blockedTaskId: v.id("tasks"),
		blockingTaskId: v.id("tasks"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);

		if (args.blockedTaskId === args.blockingTaskId) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: ERROR_TASK_RELATION_SELF,
			});
		}

		const [blockedTask, blockingTask] = await Promise.all([
			ctx.db.get("tasks", args.blockedTaskId),
			ctx.db.get("tasks", args.blockingTaskId),
		]);
		if (!blockedTask || !blockingTask) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Task not found",
			});
		}

		await requireTaskAccess(ctx, volunteer, userId, blockedTask);
		await requireTaskAccess(ctx, volunteer, userId, blockingTask);

		if (blockedTask.parentCompetitionId !== blockingTask.parentCompetitionId) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: ERROR_TASK_RELATION_SCOPE,
			});
		}

		const existingRelation = await findTaskRelation(
			ctx,
			args.blockedTaskId,
			args.blockingTaskId,
		);
		if (existingRelation) {
			return null;
		}

		const createsCycle = await wouldCreateTaskRelationCycle(
			ctx,
			args.blockedTaskId,
			args.blockingTaskId,
		);
		if (createsCycle) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: ERROR_TASK_RELATION_CYCLE,
			});
		}

		const now = Date.now();
		await ctx.db.insert("taskRelations", {
			blockedTaskId: args.blockedTaskId,
			blockingTaskId: args.blockingTaskId,
			createdById: userId,
			updatedAt: now,
		});

		if (isTaskBlockingStatus(blockingTask.status)) {
			const unresolvedCount = await countUnresolvedBlockers(
				ctx,
				args.blockedTaskId,
			);
			if (unresolvedCount === 1) {
				await sendTaskRelationBlockedNotifications(
					ctx,
					args.blockedTaskId,
					args.blockingTaskId,
					userId,
				);
			}
		}

		return null;
	},
});

export const removeBlockingRelation = mutation({
	args: {
		blockedTaskId: v.id("tasks"),
		blockingTaskId: v.id("tasks"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);

		const relation = await findTaskRelation(
			ctx,
			args.blockedTaskId,
			args.blockingTaskId,
		);
		if (!relation) {
			return null;
		}

		const [blockedTask, blockingTask] = await Promise.all([
			ctx.db.get("tasks", args.blockedTaskId),
			ctx.db.get("tasks", args.blockingTaskId),
		]);
		if (!blockedTask || !blockingTask) {
			await ctx.db.delete("taskRelations", relation._id);
			return null;
		}

		await requireTaskAccess(ctx, volunteer, userId, blockedTask);
		await requireTaskAccess(ctx, volunteer, userId, blockingTask);

		const removedActiveBlocker = isTaskBlockingStatus(blockingTask.status);
		await ctx.db.delete("taskRelations", relation._id);

		if (removedActiveBlocker) {
			const unresolvedCount = await countUnresolvedBlockers(
				ctx,
				args.blockedTaskId,
			);
			if (unresolvedCount === 0) {
				await sendTaskRelationUnblockedNotifications(
					ctx,
					args.blockedTaskId,
					args.blockingTaskId,
					userId,
				);
			}
		}

		return null;
	},
});

async function setArchiveState(
	ctx: MutationCtx,
	taskIds: Id<"tasks">[],
	archived: boolean,
) {
	const userId = await requireUserId(ctx);
	const volunteer = await isVolunteer(ctx);

	for (const taskId of taskIds) {
		const task = await ctx.db.get("tasks", taskId);
		if (!task) continue;
		await requireTaskAccess(ctx, volunteer, userId, task);
	}

	const now = Date.now();
	const archivedAt = archived ? new Date().toISOString() : undefined;
	for (const id of taskIds) {
		await ctx.db.patch("tasks", id, {
			archived,
			archivedAt,
			updatedAt: now,
		});
	}
}

export const archive = mutation({
	args: { taskIds: v.array(v.id("tasks")) },
	returns: v.null(),
	handler: async (ctx, args) => {
		await setArchiveState(ctx, args.taskIds, true);
		return null;
	},
});

export const unarchive = mutation({
	args: { taskIds: v.array(v.id("tasks")) },
	returns: v.null(),
	handler: async (ctx, args) => {
		await setArchiveState(ctx, args.taskIds, false);
		return null;
	},
});

async function modifyApprovers(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	updateIds: (currentIds: string[]) => string[],
	_activityMessage: string,
) {
	const userId = await requireUserId(ctx);
	const volunteer = await isVolunteer(ctx);
	const task = await ctx.db.get("tasks", taskId);
	if (!task)
		throw new ConvexError({ code: "NOT_FOUND", message: "Task not found" });

	await requireTaskAccess(ctx, volunteer, userId, task);

	const newIds = updateIds(task.requiredApprovalIds ?? []);
	await ctx.db.patch("tasks", taskId, {
		requiredApprovalIds: newIds,
		updatedAt: Date.now(),
	});
}

async function requireTaskApprovalPermission(
	ctx: MutationCtx,
	volunteer: boolean,
	userId: Id<"users">,
	task: Doc<"tasks">,
): Promise<void> {
	if (volunteer) return;
	const isDirector = await isDirectorForCtx(ctx);
	if (isDirector) return;
	await requireTaskAccess(ctx, volunteer, userId, task);
}

export const addRequiredApprover = mutation({
	args: {
		taskId: v.id("tasks"),
		approverType: v.union(v.literal("user"), v.literal("team")),
		approverId: v.union(v.id("users"), v.id("teams")),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const encodedId = encodeApprovalId(args.approverType, args.approverId);
		await modifyApprovers(
			ctx,
			args.taskId,
			(ids) => (ids.includes(encodedId) ? ids : [...ids, encodedId]),
			"added required approver",
		);
		return null;
	},
});

export const removeRequiredApprover = mutation({
	args: {
		taskId: v.id("tasks"),
		approverKey: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await modifyApprovers(
			ctx,
			args.taskId,
			(ids) => ids.filter((id) => id !== args.approverKey),
			"removed required approver",
		);
		return null;
	},
});

export const approveTask = mutation({
	args: {
		taskId: v.id("tasks"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Task not found" });
		}

		await requireTaskApprovalPermission(ctx, volunteer, userId, task);

		const currentApprovedIds = task.approvedByIds ?? [];
		if (currentApprovedIds.includes(userId)) {
			return null;
		}

		const newApprovedIds: Id<"users">[] = [...currentApprovedIds, userId];
		const now = Date.now();

		const { isFullyApproved } = await computeApprovalCompleteness(
			ctx,
			task.requiredApprovalIds ?? [],
			newApprovedIds,
		);

		const patch: {
			approvedByIds: Id<"users">[];
			updatedAt: number;
			status?: "done";
		} = {
			approvedByIds: newApprovedIds,
			updatedAt: now,
		};

		if (isFullyApproved && task.status === "awaiting-review") {
			patch.status = "done";
		}

		await ctx.db.patch("tasks", args.taskId, patch);

		if (patch.status === "done") {
			await sendTaskStatusChangeNotifications(
				ctx,
				args.taskId,
				task,
				task.status,
				"done",
				userId,
			);
			const relationEffects = await computeBlockingStatusTransitionEffects(
				ctx,
				args.taskId,
				task.status,
				"done",
			);
			await emitTaskRelationTransitionNotifications(
				ctx,
				relationEffects,
				userId,
			);
		}

		await sendTaskApprovalNotifications(ctx, args.taskId, task, userId);
		return null;
	},
});

export const unapproveTask = mutation({
	args: {
		taskId: v.id("tasks"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Task not found" });
		}

		await requireTaskApprovalPermission(ctx, volunteer, userId, task);

		const currentApprovedIds = task.approvedByIds ?? [];
		const filteredIds = currentApprovedIds.filter((id) => id !== userId);

		await ctx.db.patch("tasks", args.taskId, {
			approvedByIds: filteredIds,
			updatedAt: Date.now(),
		});
		await sendTaskUnapprovalNotifications(ctx, args.taskId, task, userId);
		return null;
	},
});

export const remove = mutation({
	args: { taskIds: v.array(v.id("tasks")) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);

		const allTaskIds = new Set<Id<"tasks">>();
		for (const taskId of args.taskIds) {
			const task = await ctx.db.get("tasks", taskId);
			if (!task) continue;
			await requireTaskAccess(ctx, volunteer, userId, task);
			await collectAllTaskIdsRecursively(ctx, [taskId], allTaskIds);
		}

		const taskIdArray = Array.from(allTaskIds);
		if (taskIdArray.length === 0) return null;

		await deleteTasksAndRelatedData(ctx, taskIdArray);
		return null;
	},
});
