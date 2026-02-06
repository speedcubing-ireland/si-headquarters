import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { requireUserId, isVolunteer } from "./auth";
import { internal } from "./_generated/api";
import {
	collectAllTaskIdsRecursively,
	deleteTasksAndRelatedData,
} from "./competitions";
import { userCanAccessCompetitionDoc } from "./competitionAccess";
import {
	ERROR_TASK_MOVE,
	ERROR_TASK_NO_ACCESS,
	ERROR_TASK_NO_COMPETITION,
	hasCompetitionAccess,
	requireTaskAccess,
} from "./taskAccess";
import {
	computeApprovalCompleteness,
	decodeApprovalId,
	encodeApprovalId,
	resolveApprovalData,
	scheduleAwaitingReviewNotifications,
} from "./taskApprovals";
import { formatCompetitionName } from "./taskFormat";
import {
	diffAndLog,
	logActivity,
	diffLabels,
	type ActivityConfig,
} from "./lib/activity";
import {
	sendTaskAssigneeChangeNotifications,
	sendTaskRelationBlockedNotifications,
	sendTaskRelationUnblockedNotifications,
	sendTaskStatusChangeNotifications,
} from "./taskNotifications";
import {
	buildTaskPatch,
	applyAwaitingReviewAutoPromote,
	taskUpdateArgs,
} from "./taskPatch";
import {
	taskStatus,
	taskPriority,
	approvalShape,
	linkedResource,
	userShape as sharedUserShape,
	teamShape,
} from "./lib/validators";
import { MAX_BULK_UPDATE_COUNT } from "./lib/constants";

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
	parentCompetitionId: v.optional(v.string()),
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

		if (volunteer) {
			return await ctx.db
				.query("tasks")
				.withIndex("by_archived", (q) => q.eq("archived", archived))
				.order("desc")
				.collect();
		}

		const allCompetitions = await ctx.db.query("competitions").collect();
		const accessibleCompetitionIds = allCompetitions
			.filter((comp) => userCanAccessCompetitionDoc(comp, userId))
			.map((c) => c._id);

		const taskPromises = accessibleCompetitionIds.map((compId) =>
			ctx.db
				.query("tasks")
				.withIndex("by_parent_competition_and_archived", (q) =>
					q.eq("parentCompetitionId", compId).eq("archived", archived),
				)
				.order("desc")
				.collect(),
		);

		const taskArrays = await Promise.all(taskPromises);
		const taskMap = new Map<string, Doc<"tasks">>();
		for (const taskArray of taskArrays) {
			for (const task of taskArray) {
				taskMap.set(task._id, task);
			}
		}

		return Array.from(taskMap.values()).sort(
			(a, b) => b._creationTime - a._creationTime,
		);
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
			return null;
		}

		const hasAccess = await hasCompetitionAccess(
			ctx,
			volunteer,
			userId,
			task.parentCompetitionId,
		);
		return hasAccess ? task : null;
	},
});

export const userShape = sharedUserShape;

const taskLabelShape = v.object({
	id: v.id("labels"),
	name: v.string(),
	color: v.string(),
});

const phaseShape = v.object({
	id: v.id("phases"),
	name: v.string(),
	description: v.string(),
});

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

const RESOLVED_BLOCKER_STATUSES = new Set<Doc<"tasks">["status"]>([
	"done",
	"cancelled",
]);

function isTaskBlockingStatus(status: Doc<"tasks">["status"]): boolean {
	return !RESOLVED_BLOCKER_STATUSES.has(status);
}

type RelationTaskSummary = {
	id: Id<"tasks">;
	identifier: string;
	title: string;
	status: Doc<"tasks">["status"];
};

type TaskRelationData = {
	blockedBy: Array<{ task: RelationTaskSummary; isResolved: boolean }>;
	blocks: RelationTaskSummary[];
	unresolvedBlockerCount: number;
	isBlocked: boolean;
};

const EMPTY_TASK_RELATION_DATA: TaskRelationData = {
	blockedBy: [],
	blocks: [],
	unresolvedBlockerCount: 0,
	isBlocked: false,
};

type TaskRelationReadCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

function toRelationTaskSummary(task: Doc<"tasks">): RelationTaskSummary {
	return {
		id: task._id,
		identifier: task.identifier,
		title: task.title,
		status: task.status,
	};
}

async function buildTaskRelationDataMap(
	ctx: TaskRelationReadCtx,
	taskIds: Id<"tasks">[],
): Promise<Map<Id<"tasks">, TaskRelationData>> {
	const relationData = new Map<Id<"tasks">, TaskRelationData>();
	for (const taskId of taskIds) {
		relationData.set(taskId, EMPTY_TASK_RELATION_DATA);
	}
	if (taskIds.length === 0) {
		return relationData;
	}

	const blockedRelations = (
		await Promise.all(
			taskIds.map((taskId) =>
				ctx.db
					.query("taskRelations")
					.withIndex("by_blocked_task", (q) => q.eq("blockedTaskId", taskId))
					.collect(),
			),
		)
	).flat();

	const blockingRelations = (
		await Promise.all(
			taskIds.map((taskId) =>
				ctx.db
					.query("taskRelations")
					.withIndex("by_blocking_task", (q) => q.eq("blockingTaskId", taskId))
					.collect(),
			),
		)
	).flat();

	const blockedByMap = new Map<Id<"tasks">, Doc<"taskRelations">[]>();
	for (const relation of blockedRelations) {
		const existing = blockedByMap.get(relation.blockedTaskId) ?? [];
		existing.push(relation);
		blockedByMap.set(relation.blockedTaskId, existing);
	}

	const blocksMap = new Map<Id<"tasks">, Doc<"taskRelations">[]>();
	for (const relation of blockingRelations) {
		const existing = blocksMap.get(relation.blockingTaskId) ?? [];
		existing.push(relation);
		blocksMap.set(relation.blockingTaskId, existing);
	}

	const relatedTaskIds = new Set<Id<"tasks">>();
	for (const relation of blockedRelations) {
		relatedTaskIds.add(relation.blockingTaskId);
	}
	for (const relation of blockingRelations) {
		relatedTaskIds.add(relation.blockedTaskId);
	}

	const relatedTaskIdsArray = [...relatedTaskIds];
	const relatedTaskDocs = await Promise.all(
		relatedTaskIdsArray.map((taskId) => ctx.db.get("tasks", taskId)),
	);
	const relatedTaskMap = new Map<Id<"tasks">, Doc<"tasks">>();
	relatedTaskIdsArray.forEach((taskId, index) => {
		const doc = relatedTaskDocs[index];
		if (doc) {
			relatedTaskMap.set(taskId, doc);
		}
	});

	for (const taskId of taskIds) {
		const blockedBy = (blockedByMap.get(taskId) ?? [])
			.map((relation) => {
				const blockingTask = relatedTaskMap.get(relation.blockingTaskId);
				if (!blockingTask) return null;
				return {
					task: toRelationTaskSummary(blockingTask),
					isResolved: !isTaskBlockingStatus(blockingTask.status),
				};
			})
			.filter(
				(
					relation,
				): relation is {
					task: RelationTaskSummary;
					isResolved: boolean;
				} => relation !== null,
			)
			.sort((a, b) => {
				if (a.isResolved !== b.isResolved) {
					return a.isResolved ? 1 : -1;
				}
				return a.task.identifier.localeCompare(b.task.identifier);
			});

		const blocks = (blocksMap.get(taskId) ?? [])
			.map((relation) => {
				const blockedTask = relatedTaskMap.get(relation.blockedTaskId);
				return blockedTask ? toRelationTaskSummary(blockedTask) : null;
			})
			.filter((task): task is RelationTaskSummary => task !== null)
			.sort((a, b) => a.identifier.localeCompare(b.identifier));

		const unresolvedBlockerCount = blockedBy.reduce(
			(total, relation) => total + (relation.isResolved ? 0 : 1),
			0,
		);

		relationData.set(taskId, {
			blockedBy,
			blocks,
			unresolvedBlockerCount,
			isBlocked: unresolvedBlockerCount > 0,
		});
	}

	return relationData;
}

async function countUnresolvedBlockers(
	ctx: TaskRelationReadCtx,
	blockedTaskId: Id<"tasks">,
): Promise<number> {
	const relations = await ctx.db
		.query("taskRelations")
		.withIndex("by_blocked_task", (q) => q.eq("blockedTaskId", blockedTaskId))
		.collect();
	if (relations.length === 0) {
		return 0;
	}

	const blockingTaskDocs = await Promise.all(
		relations.map((relation) => ctx.db.get("tasks", relation.blockingTaskId)),
	);
	return blockingTaskDocs.reduce((total, task) => {
		if (task && isTaskBlockingStatus(task.status)) {
			return total + 1;
		}
		return total;
	}, 0);
}

async function wouldCreateTaskRelationCycle(
	ctx: TaskRelationReadCtx,
	blockedTaskId: Id<"tasks">,
	blockingTaskId: Id<"tasks">,
): Promise<boolean> {
	if (blockedTaskId === blockingTaskId) {
		return true;
	}

	const queue: Id<"tasks">[] = [blockedTaskId];
	const visited = new Set<Id<"tasks">>();

	while (queue.length > 0) {
		const currentTaskId = queue.shift();
		if (!currentTaskId || visited.has(currentTaskId)) {
			continue;
		}
		if (currentTaskId === blockingTaskId) {
			return true;
		}
		visited.add(currentTaskId);

		const downstreamRelations = await ctx.db
			.query("taskRelations")
			.withIndex("by_blocking_task", (q) =>
				q.eq("blockingTaskId", currentTaskId),
			)
			.collect();
		for (const relation of downstreamRelations) {
			if (!visited.has(relation.blockedTaskId)) {
				queue.push(relation.blockedTaskId);
			}
		}
	}

	return false;
}

async function handleBlockingStatusTransitionNotifications(
	ctx: MutationCtx,
	blockingTaskId: Id<"tasks">,
	oldStatus: Doc<"tasks">["status"],
	newStatus: Doc<"tasks">["status"],
	actorId: Id<"users">,
): Promise<void> {
	const wasBlocking = isTaskBlockingStatus(oldStatus);
	const isBlocking = isTaskBlockingStatus(newStatus);
	if (wasBlocking === isBlocking) {
		return;
	}

	const relations = await ctx.db
		.query("taskRelations")
		.withIndex("by_blocking_task", (q) =>
			q.eq("blockingTaskId", blockingTaskId),
		)
		.collect();
	if (relations.length === 0) {
		return;
	}

	const blockedTaskIds = [...new Set(relations.map((r) => r.blockedTaskId))];
	await Promise.all(
		blockedTaskIds.map(async (blockedTaskId) => {
			const unresolvedCount = await countUnresolvedBlockers(ctx, blockedTaskId);
			if (wasBlocking && !isBlocking && unresolvedCount === 0) {
				await sendTaskRelationUnblockedNotifications(
					ctx,
					blockedTaskId,
					blockingTaskId,
					actorId,
				);
			}
			if (!wasBlocking && isBlocking && unresolvedCount === 1) {
				await sendTaskRelationBlockedNotifications(
					ctx,
					blockedTaskId,
					blockingTaskId,
					actorId,
				);
			}
		}),
	);
}

export const taskForUIReturns = v.object({
	id: v.id("tasks"),
	identifier: v.string(),
	parent: parentShape,
	parentDisplayName: v.union(v.string(), v.null()),
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
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		const archived = args.archived ?? false;
		const competitionId = args.competitionId;

		let tasks: Doc<"tasks">[];
		if (competitionId) {
			if (!volunteer) {
				const hasAccess = await hasCompetitionAccess(
					ctx,
					volunteer,
					userId,
					competitionId,
				);
				if (!hasAccess) {
					return [];
				}
			}
			tasks = await ctx.db
				.query("tasks")
				.withIndex("by_parent_competition_and_archived", (q) =>
					q.eq("parentCompetitionId", competitionId).eq("archived", archived),
				)
				.order("desc")
				.collect();
		} else {
			if (volunteer) {
				tasks = await ctx.db
					.query("tasks")
					.withIndex("by_archived", (q) => q.eq("archived", archived))
					.order("desc")
					.collect();
			} else {
				const allTasks = await ctx.db
					.query("tasks")
					.withIndex("by_archived", (q) => q.eq("archived", archived))
					.order("desc")
					.collect();

				const allCompetitions = await ctx.db.query("competitions").collect();

				const accessibleCompetitionIds = new Set(
					allCompetitions
						.filter((comp) => userCanAccessCompetitionDoc(comp, userId))
						.map((c) => c._id),
				);

				tasks = allTasks.filter(
					(task) =>
						!task.parentCompetitionId ||
						accessibleCompetitionIds.has(task.parentCompetitionId),
				);
			}
		}

		const relationDataByTask = await buildTaskRelationDataMap(
			ctx,
			tasks.map((task) => task._id),
		);

		const labelIds = new Set<Id<"labels">>();
		const userIds = new Set<Id<"users">>();
		const teamIds = new Set<Id<"teams">>();
		const phaseIds = new Set<Id<"phases">>();
		const approvalTeamIds = new Set<Id<"teams">>();
		for (const t of tasks) {
			for (const lid of t.labelIds) labelIds.add(lid);
			if (t.assigneeId) userIds.add(t.assigneeId);
			if (t.ownerId) {
				if (t.ownerType === "team") teamIds.add(t.ownerId as Id<"teams">);
				else userIds.add(t.ownerId as Id<"users">);
			}
			if (t.phaseId) phaseIds.add(t.phaseId);
			if (t.requiredApprovalIds) {
				for (const encoded of t.requiredApprovalIds) {
					const decoded = decodeApprovalId(encoded);
					if (decoded?.type === "user") {
						userIds.add(decoded.id);
					} else if (decoded?.type === "team") {
						approvalTeamIds.add(decoded.id);
					}
				}
			}
			if (t.approvedByIds) {
				for (const uid of t.approvedByIds) {
					userIds.add(uid);
				}
			}
		}

		const labelArr = [...labelIds];
		const userArr = [...userIds];
		const teamArr = [...teamIds];
		const approvalTeamArr = [...approvalTeamIds];
		const phaseArr = [...phaseIds];

		const [labelDocs, userDocs, teamDocs, approvalTeamDocs, phaseDocs] =
			await Promise.all([
				Promise.all(labelArr.map((id) => ctx.db.get("labels", id))),
				Promise.all(userArr.map((id) => ctx.db.get("users", id))),
				Promise.all(teamArr.map((id) => ctx.db.get("teams", id))),
				Promise.all(approvalTeamArr.map((id) => ctx.db.get("teams", id))),
				Promise.all(phaseArr.map((id) => ctx.db.get("phases", id))),
			]);

		const labelsMap = new Map<
			Id<"labels">,
			{ id: Id<"labels">; name: string; color: string }
		>();
		labelArr.forEach((id, i) => {
			const l = labelDocs[i];
			if (l) labelsMap.set(id, { id, name: l.name, color: l.color });
		});

		const usersMap = new Map<
			Id<"users">,
			{ id: Id<"users">; name: string; avatarUrl: string }
		>();
		userArr.forEach((id, i) => {
			const u = userDocs[i];
			if (u)
				usersMap.set(id, { id, name: u.name ?? "", avatarUrl: u.image ?? "" });
		});

		const memberIds = new Set<Id<"users">>();
		[...teamDocs, ...approvalTeamDocs].forEach((t) => {
			t?.memberIds.forEach((mid) => {
				memberIds.add(mid);
			});
		});
		const memberDocs = await Promise.all(
			[...memberIds].map((id) => ctx.db.get("users", id)),
		);
		const memberMap = new Map<
			Id<"users">,
			{ id: Id<"users">; name: string; avatarUrl: string }
		>();
		[...memberIds].forEach((id, i) => {
			const u = memberDocs[i];
			if (u)
				memberMap.set(id, { id, name: u.name ?? "", avatarUrl: u.image ?? "" });
		});

		const teamsMap = new Map<
			Id<"teams">,
			{
				id: Id<"teams">;
				name: string;
				members: { id: Id<"users">; name: string; avatarUrl: string }[];
			}
		>();
		teamArr.forEach((id, i) => {
			const t = teamDocs[i];
			if (t)
				teamsMap.set(id, {
					id,
					name: t.name,
					members: t.memberIds
						.map((mid) => memberMap.get(mid))
						.filter(
							(u): u is { id: Id<"users">; name: string; avatarUrl: string } =>
								Boolean(u),
						),
				});
		});

		const approvalTeamsMap = new Map<
			Id<"teams">,
			{
				id: Id<"teams">;
				name: string;
				members: { id: Id<"users">; name: string; avatarUrl: string }[];
			}
		>();
		approvalTeamArr.forEach((id, i) => {
			const t = approvalTeamDocs[i];
			if (t)
				approvalTeamsMap.set(id, {
					id,
					name: t.name,
					members: t.memberIds
						.map((mid) => memberMap.get(mid))
						.filter(
							(u): u is { id: Id<"users">; name: string; avatarUrl: string } =>
								Boolean(u),
						),
				});
		});

		const phasesMap = new Map<
			Id<"phases">,
			{ id: Id<"phases">; name: string; description: string }
		>();
		phaseArr.forEach((id, i) => {
			const p = phaseDocs[i];
			if (p)
				phasesMap.set(id, {
					id,
					name: p.name,
					description: p.description,
				});
		});

		const taskIdToTitle = new Map<Id<"tasks">, string>();
		for (const t of tasks) {
			taskIdToTitle.set(t._id, t.title);
		}

		const parentCompetitionIds = [
			...new Set(
				tasks
					.map((t) => t.parentCompetitionId)
					.filter((id): id is Id<"competitions"> => id != null),
			),
		];
		const competitionDocs = await Promise.all(
			parentCompetitionIds.map((id) => ctx.db.get("competitions", id)),
		);
		const competitionIdToName = new Map<Id<"competitions">, string>();
		parentCompetitionIds.forEach((id, i) => {
			const doc = competitionDocs[i];
			if (doc) competitionIdToName.set(id, formatCompetitionName(doc.name));
		});

		const parentTaskIds = new Set(tasks.map((t) => t._id));
		const subtaskRowsByParent = new Map<
			Id<"tasks">,
			Array<{
				id: Id<"tasks">;
				title: string;
				status:
					| "backlog"
					| "to-do"
					| "in-progress"
					| "awaiting-review"
					| "done"
					| "cancelled";
			}>
		>();
		await Promise.all(
			[...parentTaskIds].map(async (parentId) => {
				const children = await ctx.db
					.query("tasks")
					.withIndex("by_parent_task", (q) => q.eq("parentTaskId", parentId))
					.collect();
				const matching = children.filter((c) => c.archived === archived);
				subtaskRowsByParent.set(
					parentId,
					matching.map((c) => ({
						id: c._id,
						title: c.title,
						status: c.status,
					})),
				);
			}),
		);

		const toISO = (ms: number) => new Date(ms).toISOString();

		const resolvedTasks = await Promise.all(
			tasks.map(async (t) => {
				const owner = t.ownerId
					? t.ownerType === "team"
						? teamsMap.get(t.ownerId as Id<"teams">)
						: usersMap.get(t.ownerId as Id<"users">)
					: null;
				const assignee = t.assigneeId
					? (usersMap.get(t.assigneeId) ?? null)
					: null;
				const phase = t.phaseId ? (phasesMap.get(t.phaseId) ?? null) : null;
				const labels = t.labelIds
					.map((lid: Id<"labels">) => labelsMap.get(lid))
					.filter(Boolean) as {
					id: Id<"labels">;
					name: string;
					color: string;
				}[];
				const parent = t.parentTaskId
					? { type: "task" as const, linkedId: t.parentTaskId }
					: t.parentCompetitionId
						? { type: "competition" as const, linkedId: t.parentCompetitionId }
						: null;

				const parentDisplayName: string | null = parent
					? parent.type === "task"
						? (taskIdToTitle.get(parent.linkedId) ?? null)
						: (competitionIdToName.get(parent.linkedId) ?? null)
					: null;

				const subTasks = subtaskRowsByParent.get(t._id) ?? [];
				const relationData =
					relationDataByTask.get(t._id) ?? EMPTY_TASK_RELATION_DATA;

				const combinedTeamsMap = new Map(teamsMap);
				for (const [key, value] of approvalTeamsMap) {
					combinedTeamsMap.set(key, value);
				}
				const { requiredApprovalBy, approvedBy } = resolveApprovalData(
					ctx,
					t.requiredApprovalIds ?? [],
					t.approvedByIds ?? [],
					usersMap,
					combinedTeamsMap,
				);

				return {
					id: t._id,
					identifier: t.identifier,
					parent,
					parentDisplayName,
					title: t.title,
					description: t.description,
					owner: owner ?? null,
					assignee,
					phase,
					status: t.status,
					priority: t.priority,
					dueDate: t.dueDate ?? null,
					requiredApprovalBy,
					approvedBy,
					labels,
					blockedBy: relationData.blockedBy,
					blocks: relationData.blocks,
					unresolvedBlockerCount: relationData.unresolvedBlockerCount,
					isBlocked: relationData.isBlocked,
					resources: t.resources ?? [],
					subTasks,
					createdAt: toISO(t._creationTime),
					updatedAt: toISO(t.updatedAt),
					archivedAt: t.archivedAt ?? null,
				};
			}),
		);
		return resolvedTasks;
	},
});

export const getForUI = query({
	args: { taskId: v.id("tasks") },
	returns: v.union(taskForUIReturns, v.null()),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const t = await ctx.db.get("tasks", args.taskId);
		if (!t) return null;

		const volunteer = await isVolunteer(ctx);
		if (!volunteer) {
			if (!t.parentCompetitionId) {
				return null;
			}
			const hasAccess = await hasCompetitionAccess(
				ctx,
				volunteer,
				userId,
				t.parentCompetitionId,
			);
			if (!hasAccess) {
				return null;
			}
		}

		const relationDataByTask = await buildTaskRelationDataMap(ctx, [
			args.taskId,
		]);

		const approvalUserIds = new Set<Id<"users">>();
		const approvalTeamIds = new Set<Id<"teams">>();
		if (t.requiredApprovalIds) {
			for (const encoded of t.requiredApprovalIds) {
				const decoded = decodeApprovalId(encoded);
				if (decoded?.type === "user") {
					approvalUserIds.add(decoded.id);
				} else if (decoded?.type === "team") {
					approvalTeamIds.add(decoded.id);
				}
			}
		}
		if (t.approvedByIds) {
			for (const uid of t.approvedByIds) {
				approvalUserIds.add(uid);
			}
		}

		const [
			labelDocs,
			assigneeDoc,
			ownerDoc,
			phaseDoc,
			approvalUserDocs,
			approvalTeamDocs,
		] = await Promise.all([
			Promise.all(t.labelIds.map((lid) => ctx.db.get("labels", lid))),
			t.assigneeId ? ctx.db.get("users", t.assigneeId) : Promise.resolve(null),
			t.ownerId
				? t.ownerType === "team"
					? ctx.db.get("teams", t.ownerId as Id<"teams">)
					: ctx.db.get("users", t.ownerId as Id<"users">)
				: Promise.resolve(null),
			t.phaseId ? ctx.db.get("phases", t.phaseId) : null,
			Promise.all([...approvalUserIds].map((id) => ctx.db.get("users", id))),
			Promise.all([...approvalTeamIds].map((id) => ctx.db.get("teams", id))),
		]);

		const labelsMap = new Map<
			Id<"labels">,
			{ id: Id<"labels">; name: string; color: string }
		>();
		t.labelIds.forEach((id, i) => {
			const l = labelDocs[i];
			if (l) labelsMap.set(id, { id, name: l.name, color: l.color });
		});
		const assignee = assigneeDoc
			? {
					id: assigneeDoc._id,
					name: assigneeDoc.name ?? "",
					avatarUrl: assigneeDoc.image ?? "",
				}
			: null;

		let owner:
			| {
					id: Id<"teams">;
					name: string;
					members: { id: Id<"users">; name: string; avatarUrl: string }[];
			  }
			| { id: Id<"users">; name: string; avatarUrl: string }
			| null = null;
		if (ownerDoc) {
			if ("memberIds" in ownerDoc) {
				const memberDocs = await Promise.all(
					ownerDoc.memberIds.map((mid) => ctx.db.get("users", mid)),
				);
				const members: {
					id: Id<"users">;
					name: string;
					avatarUrl: string;
				}[] = [];
				ownerDoc.memberIds.forEach((mid, i) => {
					const u = memberDocs[i];
					if (u)
						members.push({
							id: mid,
							name: u.name ?? "",
							avatarUrl: u.image ?? "",
						});
				});
				owner = { id: ownerDoc._id, name: ownerDoc.name, members };
			} else {
				owner = {
					id: ownerDoc._id,
					name: ownerDoc.name ?? "",
					avatarUrl: ownerDoc.image ?? "",
				};
			}
		}

		const phase = phaseDoc
			? {
					id: phaseDoc._id,
					name: phaseDoc.name,
					description: phaseDoc.description,
				}
			: null;

		const labels = t.labelIds
			.map((lid) => labelsMap.get(lid))
			.filter(Boolean) as { id: Id<"labels">; name: string; color: string }[];
		const parent = t.parentTaskId
			? { type: "task" as const, linkedId: t.parentTaskId }
			: t.parentCompetitionId
				? { type: "competition" as const, linkedId: t.parentCompetitionId }
				: null;

		let parentDisplayName: string | null = null;
		if (parent) {
			if (parent.type === "task") {
				const parentTask = await ctx.db.get("tasks", parent.linkedId);
				parentDisplayName = parentTask?.title ?? null;
			} else {
				const comp = await ctx.db.get("competitions", parent.linkedId);
				parentDisplayName = comp ? formatCompetitionName(comp.name) : null;
			}
		}

		const childTasks = await ctx.db
			.query("tasks")
			.withIndex("by_parent_task", (q) => q.eq("parentTaskId", args.taskId))
			.collect();
		const subTasks = childTasks
			.filter((c) => c.archived === t.archived)
			.map((c) => ({
				id: c._id,
				title: c.title,
				status: c.status,
			}));

		const toISO = (ms: number) => new Date(ms).toISOString();

		const approvalUsersMap = new Map<
			Id<"users">,
			{ id: Id<"users">; name: string; avatarUrl: string }
		>();
		[...approvalUserIds].forEach((id, i) => {
			const u = approvalUserDocs[i];
			if (u)
				approvalUsersMap.set(id, {
					id,
					name: u.name ?? "",
					avatarUrl: u.image ?? "",
				});
		});

		const approvalTeamMemberIds = new Set<Id<"users">>();
		approvalTeamDocs.forEach((team) => {
			team?.memberIds.forEach((mid) => {
				approvalTeamMemberIds.add(mid);
			});
		});
		const approvalTeamMemberDocs = await Promise.all(
			[...approvalTeamMemberIds].map((id) => ctx.db.get("users", id)),
		);
		const approvalTeamMemberMap = new Map<
			Id<"users">,
			{ id: Id<"users">; name: string; avatarUrl: string }
		>();
		[...approvalTeamMemberIds].forEach((id, i) => {
			const u = approvalTeamMemberDocs[i];
			if (u)
				approvalTeamMemberMap.set(id, {
					id,
					name: u.name ?? "",
					avatarUrl: u.image ?? "",
				});
		});

		const approvalTeamsMap = new Map<
			Id<"teams">,
			{
				id: Id<"teams">;
				name: string;
				members: { id: Id<"users">; name: string; avatarUrl: string }[];
			}
		>();
		[...approvalTeamIds].forEach((id, i) => {
			const team = approvalTeamDocs[i];
			if (team)
				approvalTeamsMap.set(id, {
					id,
					name: team.name,
					members: team.memberIds
						.map((mid) => approvalTeamMemberMap.get(mid))
						.filter(
							(u): u is { id: Id<"users">; name: string; avatarUrl: string } =>
								u !== undefined,
						),
				});
		});

		const combinedUsersMap = new Map(approvalUsersMap);
		if (assignee) {
			combinedUsersMap.set(assignee.id, assignee);
		}
		if (owner && "avatarUrl" in owner) {
			combinedUsersMap.set(owner.id, owner);
		}
		const { requiredApprovalBy, approvedBy } = resolveApprovalData(
			ctx,
			t.requiredApprovalIds ?? [],
			t.approvedByIds ?? [],
			combinedUsersMap,
			approvalTeamsMap,
		);
		const relationData =
			relationDataByTask.get(args.taskId) ?? EMPTY_TASK_RELATION_DATA;

		return {
			id: t._id,
			identifier: t.identifier,
			parent,
			parentDisplayName,
			title: t.title,
			description: t.description,
			owner,
			assignee,
			phase,
			status: t.status,
			priority: t.priority,
			dueDate: t.dueDate ?? null,
			requiredApprovalBy,
			approvedBy,
			labels,
			blockedBy: relationData.blockedBy,
			blocks: relationData.blocks,
			unresolvedBlockerCount: relationData.unresolvedBlockerCount,
			isBlocked: relationData.isBlocked,
			resources: t.resources ?? [],
			subTasks,
			createdAt: toISO(t._creationTime),
			updatedAt: toISO(t.updatedAt),
			archivedAt: t.archivedAt ?? null,
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

const TASK_ACTIVITY_CONFIG: ActivityConfig<Doc<"tasks">> = {
	status: { type: "status_changed" },
	priority: { type: "priority_changed" },
	dueDate: { type: "due_date_changed" },
	phaseId: { type: "phase_changed" },
	assigneeId: {
		type: "assignee_changed",
		transform: async (val, ctx) => {
			if (!val) return undefined;

			const user = await ctx?.db.get("users", val as Id<"users">);
			return user?.name;
		},
	},
	resources: {
		type: "resources_changed",
		transform: (r) => (r ? "resources updated" : undefined),
	},
};

const ERROR_TASK_RELATION_SELF = "A task cannot block itself";
const ERROR_TASK_RELATION_SCOPE =
	"Tasks can only block tasks within the same competition";
const ERROR_TASK_RELATION_CYCLE =
	"This dependency would create a blocking cycle";

export const create = mutation({
	args: taskCreateArgs,
	returns: v.id("tasks"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);

		if (args.parentCompetitionId) {
			if (!volunteer) {
				const hasAccess = await hasCompetitionAccess(
					ctx,
					volunteer,
					userId,
					args.parentCompetitionId,
				);
				if (!hasAccess) {
					throw new ConvexError({
						code: "FORBIDDEN",
						message: ERROR_TASK_NO_ACCESS,
					});
				}
			}
		} else if (!volunteer) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: ERROR_TASK_NO_COMPETITION,
			});
		}

		const now = Date.now();

		const counter = await ctx.db.query("taskCounter").first();
		let nextNum: number;

		if (!counter) {
			await ctx.db.insert("taskCounter", { next: 2 });
			nextNum = 1;
		} else {
			nextNum = counter.next;
			await ctx.db.patch("taskCounter", counter._id, { next: nextNum + 1 });
		}

		const identifier = `HQ-${nextNum}`;

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
			ownerId: args.ownerId,
			ownerType: args.ownerType,
			assigneeId: args.assigneeId,
			phaseId: args.phaseId,
			labelIds: args.labelIds ?? [],
			requiredApprovalIds: args.requiredApprovalIds ?? [],
			updatedAt: now,
		});

		if (args.assigneeId && args.assigneeId !== userId && userId) {
			await ctx.scheduler.runAfter(
				0,
				internal.notifications._notifyTaskAssigned,
				{
					taskId,
					assigneeId: args.assigneeId,
					actorId: userId,
				},
			);
		}

		await logActivity(ctx, userId, "task", taskId, "created");
		return taskId;
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

		if (
			!volunteer &&
			args.updates.parentCompetitionId !== undefined &&
			args.updates.parentCompetitionId !== null
		) {
			const newHasAccess = await hasCompetitionAccess(
				ctx,
				volunteer,
				userId,
				args.updates.parentCompetitionId,
			);
			if (!newHasAccess) {
				throw new ConvexError({
					code: "FORBIDDEN",
					message: ERROR_TASK_MOVE,
				});
			}
		}
		const now = Date.now();
		const patch = buildTaskPatch(args.updates, now);
		await applyAwaitingReviewAutoPromote(ctx, doc, patch);

		const oldAssigneeId = doc.assigneeId;
		const newAssigneeId =
			args.updates.assigneeId === null ? undefined : args.updates.assigneeId;
		const oldStatus = doc.status;
		const newStatus: Doc<"tasks">["status"] =
			patch.status ?? args.updates.status ?? doc.status;

		await ctx.db.patch("tasks", args.taskId, patch);

		if (!userId) return null;

		await diffAndLog(
			ctx,
			userId,
			"task",
			args.taskId,
			doc,
			patch,
			TASK_ACTIVITY_CONFIG,
		);

		if (args.updates.labelIds) {
			await diffLabels(
				ctx,
				userId,
				"task",
				args.taskId,
				doc.labelIds,
				args.updates.labelIds,
			);
		}

		if (oldAssigneeId !== newAssigneeId) {
			sendTaskAssigneeChangeNotifications(
				ctx,
				args.taskId,
				oldAssigneeId,
				newAssigneeId,
				userId,
			);
		}

		if (oldStatus !== newStatus && args.updates.status !== undefined) {
			sendTaskStatusChangeNotifications(
				ctx,
				args.taskId,
				doc,
				oldStatus,
				newStatus,
				userId,
			);
			await handleBlockingStatusTransitionNotifications(
				ctx,
				args.taskId,
				oldStatus,
				newStatus,
				userId,
			);
		}

		if (newStatus === "awaiting-review") {
			await scheduleAwaitingReviewNotifications(
				ctx,
				args.taskId,
				doc.requiredApprovalIds,
				userId,
			);
		}

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

			if (
				!volunteer &&
				args.updates.parentCompetitionId !== undefined &&
				args.updates.parentCompetitionId !== null
			) {
				const newHasAccess = await hasCompetitionAccess(
					ctx,
					volunteer,
					userId,
					args.updates.parentCompetitionId,
				);
				if (!newHasAccess) {
					throw new ConvexError({
						code: "FORBIDDEN",
						message: ERROR_TASK_MOVE,
					});
				}
			}
		}

		const now = Date.now();

		for (const taskId of args.taskIds) {
			const doc = taskMap.get(taskId);
			if (!doc) continue;

			const patch = buildTaskPatch(args.updates, now);
			await applyAwaitingReviewAutoPromote(ctx, doc, patch);

			const newStatus: Doc<"tasks">["status"] =
				patch.status ?? args.updates.status ?? doc.status;
			const oldAssigneeId = doc.assigneeId;
			const newAssigneeId =
				args.updates.assigneeId === undefined
					? doc.assigneeId
					: (args.updates.assigneeId ?? undefined);
			const oldStatus = doc.status;

			await ctx.db.patch("tasks", taskId, patch);

			await diffAndLog(
				ctx,
				userId,
				"task",
				taskId,
				doc,
				patch,
				TASK_ACTIVITY_CONFIG,
			);

			if (args.updates.labelIds) {
				await diffLabels(
					ctx,
					userId,
					"task",
					taskId,
					doc.labelIds,
					args.updates.labelIds,
				);
			}

			if (oldAssigneeId !== newAssigneeId) {
				sendTaskAssigneeChangeNotifications(
					ctx,
					taskId,
					oldAssigneeId,
					newAssigneeId,
					userId,
				);
			}

			if (oldStatus !== newStatus && args.updates.status !== undefined) {
				sendTaskStatusChangeNotifications(
					ctx,
					taskId,
					doc,
					oldStatus,
					newStatus,
					userId,
				);
				await handleBlockingStatusTransitionNotifications(
					ctx,
					taskId,
					oldStatus,
					newStatus,
					userId,
				);
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

		return null;
	},
});

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

		const existingRelation = await ctx.db
			.query("taskRelations")
			.withIndex("by_blocked_and_blocking", (q) =>
				q
					.eq("blockedTaskId", args.blockedTaskId)
					.eq("blockingTaskId", args.blockingTaskId),
			)
			.first();
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

		await logActivity(ctx, userId, "task", args.blockedTaskId, "updated", {
			message: `blocked by ${blockingTask.identifier}`,
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

		const relation = await ctx.db
			.query("taskRelations")
			.withIndex("by_blocked_and_blocking", (q) =>
				q
					.eq("blockedTaskId", args.blockedTaskId)
					.eq("blockingTaskId", args.blockingTaskId),
			)
			.first();
		if (!relation) {
			return null;
		}

		const [blockedTask, blockingTask] = await Promise.all([
			ctx.db.get("tasks", args.blockedTaskId),
			ctx.db.get("tasks", args.blockingTaskId),
		]);
		if (!blockedTask || !blockingTask) {
			await ctx.db.delete(relation._id);
			return null;
		}

		await requireTaskAccess(ctx, volunteer, userId, blockedTask);
		await requireTaskAccess(ctx, volunteer, userId, blockingTask);

		const removedActiveBlocker = isTaskBlockingStatus(blockingTask.status);
		await ctx.db.delete(relation._id);

		await logActivity(ctx, userId, "task", args.blockedTaskId, "updated", {
			message: `unblocked from ${blockingTask.identifier}`,
		});

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

export const archive = mutation({
	args: { taskIds: v.array(v.id("tasks")) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);

		for (const taskId of args.taskIds) {
			const task = await ctx.db.get("tasks", taskId);
			if (!task) continue;
			await requireTaskAccess(ctx, volunteer, userId, task);
		}

		const archivedAt = new Date().toISOString();
		for (const id of args.taskIds) {
			await ctx.db.patch("tasks", id, {
				archived: true,
				archivedAt,
				updatedAt: Date.now(),
			});
			await logActivity(ctx, userId, "task", id, "archived");
		}
		return null;
	},
});

export const unarchive = mutation({
	args: { taskIds: v.array(v.id("tasks")) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);

		for (const taskId of args.taskIds) {
			const task = await ctx.db.get("tasks", taskId);
			if (!task) continue;
			await requireTaskAccess(ctx, volunteer, userId, task);
		}

		for (const id of args.taskIds) {
			await ctx.db.patch("tasks", id, {
				archived: false,
				archivedAt: undefined,
				updatedAt: Date.now(),
			});
			await logActivity(ctx, userId, "task", id, "unarchived");
		}
		return null;
	},
});

export const addRequiredApprover = mutation({
	args: {
		taskId: v.id("tasks"),
		approverType: v.union(v.literal("user"), v.literal("team")),
		approverId: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task) {
			throw new ConvexError("Task not found");
		}

		await requireTaskAccess(ctx, volunteer, userId, task);

		const encodedId = encodeApprovalId(
			args.approverType,
			args.approverId as Id<"users"> | Id<"teams">,
		);
		const currentIds = task.requiredApprovalIds ?? [];
		if (currentIds.includes(encodedId)) {
			return null;
		}

		await ctx.db.patch("tasks", args.taskId, {
			requiredApprovalIds: [...currentIds, encodedId],
			updatedAt: Date.now(),
		});

		await logActivity(ctx, userId, "task", args.taskId, "updated", {
			message: "added required approver",
		});
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
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task) {
			throw new ConvexError("Task not found");
		}

		await requireTaskAccess(ctx, volunteer, userId, task);

		const currentIds = task.requiredApprovalIds ?? [];
		const filteredIds = currentIds.filter((id) => id !== args.approverKey);

		await ctx.db.patch("tasks", args.taskId, {
			requiredApprovalIds: filteredIds,
			updatedAt: Date.now(),
		});

		await logActivity(ctx, userId, "task", args.taskId, "updated", {
			message: "removed required approver",
		});
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
			throw new ConvexError("Task not found");
		}

		await requireTaskAccess(ctx, volunteer, userId, task);

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
			sendTaskStatusChangeNotifications(
				ctx,
				args.taskId,
				task,
				task.status,
				"done",
				userId,
			);
			await handleBlockingStatusTransitionNotifications(
				ctx,
				args.taskId,
				task.status,
				"done",
				userId,
			);
		}

		await logActivity(ctx, userId, "task", args.taskId, "approved");
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
			throw new ConvexError("Task not found");
		}

		await requireTaskAccess(ctx, volunteer, userId, task);

		const currentApprovedIds = task.approvedByIds ?? [];
		const filteredIds = currentApprovedIds.filter((id) => id !== userId);

		await ctx.db.patch("tasks", args.taskId, {
			approvedByIds: filteredIds,
			updatedAt: Date.now(),
		});
		await logActivity(ctx, userId, "task", args.taskId, "unapproved");
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
