import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";

const RESOLVED_BLOCKER_STATUSES = new Set<Doc<"tasks">["status"]>([
	"done",
	"cancelled",
]);

export function isTaskBlockingStatus(status: Doc<"tasks">["status"]): boolean {
	return !RESOLVED_BLOCKER_STATUSES.has(status);
}

export type RelationTaskSummary = {
	id: Id<"tasks">;
	identifier: string;
	title: string;
	status: Doc<"tasks">["status"];
};

export type TaskRelationData = {
	blockedBy: Array<{ task: RelationTaskSummary; isResolved: boolean }>;
	blocks: RelationTaskSummary[];
	unresolvedBlockerCount: number;
	isBlocked: boolean;
};

export const EMPTY_TASK_RELATION_DATA: TaskRelationData = {
	blockedBy: [],
	blocks: [],
	unresolvedBlockerCount: 0,
	isBlocked: false,
};

export type TaskRelationTransitionEffect = {
	type: "blocked" | "unblocked";
	blockedTaskId: Id<"tasks">;
	blockingTaskId: Id<"tasks">;
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

export async function buildTaskRelationDataMap(
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
					.withIndex("by_blocked_and_blocking", (q) =>
						q.eq("blockedTaskId", taskId),
					)
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

export async function countUnresolvedBlockers(
	ctx: TaskRelationReadCtx,
	blockedTaskId: Id<"tasks">,
): Promise<number> {
	const relations = await ctx.db
		.query("taskRelations")
		.withIndex("by_blocked_and_blocking", (q) =>
			q.eq("blockedTaskId", blockedTaskId),
		)
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

export async function wouldCreateTaskRelationCycle(
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

export async function computeBlockingStatusTransitionEffects(
	ctx: MutationCtx,
	blockingTaskId: Id<"tasks">,
	oldStatus: Doc<"tasks">["status"],
	newStatus: Doc<"tasks">["status"],
): Promise<TaskRelationTransitionEffect[]> {
	const wasBlocking = isTaskBlockingStatus(oldStatus);
	const isBlocking = isTaskBlockingStatus(newStatus);
	if (wasBlocking === isBlocking) {
		return [];
	}

	const relations = await ctx.db
		.query("taskRelations")
		.withIndex("by_blocking_task", (q) =>
			q.eq("blockingTaskId", blockingTaskId),
		)
		.collect();
	if (relations.length === 0) {
		return [];
	}

	const blockedTaskIds = [...new Set(relations.map((r) => r.blockedTaskId))];
	const effects = await Promise.all(
		blockedTaskIds.map(
			async (blockedTaskId): Promise<TaskRelationTransitionEffect | null> => {
				const unresolvedCount = await countUnresolvedBlockers(
					ctx,
					blockedTaskId,
				);
				if (wasBlocking && !isBlocking && unresolvedCount === 0) {
					return { type: "unblocked", blockedTaskId, blockingTaskId };
				}
				if (!wasBlocking && isBlocking && unresolvedCount === 1) {
					return { type: "blocked", blockedTaskId, blockingTaskId };
				}
				return null;
			},
		),
	);
	return effects.filter(
		(effect): effect is TaskRelationTransitionEffect => effect !== null,
	);
}
