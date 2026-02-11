import type { QueryCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { resolveApprovalData } from "../taskApprovals";
import { hasStandaloneTaskAccess } from "../taskAccess";
import { toISO } from "./transforms";
import type { EMPTY_TASK_RELATION_DATA } from "./taskRelations";
import type { TaskEntityMaps, LabelRef } from "./taskHydration";

export interface SubtaskFilterOptions {
	archived: boolean;
	volunteer: boolean;
	userId: Id<"users">;
	accessibleCompetitionIds?: Set<Id<"competitions">>;
	parentTaskCompetitionId?: Id<"competitions">;
}

export function filterAccessibleSubtasks(
	children: Doc<"tasks">[],
	opts: SubtaskFilterOptions,
): Array<{ id: Id<"tasks">; title: string; status: Doc<"tasks">["status"] }> {
	return children
		.filter((child) => {
			if (child.archived !== opts.archived) return false;
			if (opts.volunteer) return true;
			if (!child.parentCompetitionId) {
				return hasStandaloneTaskAccess(child, opts.userId);
			}
			
			if (opts.parentTaskCompetitionId !== undefined) {
				return child.parentCompetitionId === opts.parentTaskCompetitionId;
			}
			
			return (
				opts.accessibleCompetitionIds?.has(child.parentCompetitionId) ?? false
			);
		})
		.map((c) => ({ id: c._id, title: c.title, status: c.status }));
}

export interface TransformTaskOptions {
	maps: TaskEntityMaps;
	subTasks: Array<{
		id: Id<"tasks">;
		title: string;
		status: Doc<"tasks">["status"];
	}>;
	relationData: typeof EMPTY_TASK_RELATION_DATA;
	parentDisplayNameOverride?: string | null;
}

export function resolveTaskParent(
	task: Pick<Doc<"tasks">, "parentTaskId" | "parentCompetitionId">,
) {
	if (task.parentTaskId)
		return { type: "task" as const, linkedId: task.parentTaskId };
	if (task.parentCompetitionId)
		return { type: "competition" as const, linkedId: task.parentCompetitionId };
	return null;
}

export function transformTaskToUI(
	ctx: QueryCtx,
	t: Doc<"tasks">,
	opts: TransformTaskOptions,
) {
	const { maps, subTasks, relationData } = opts;

	const owner = t.ownerId
		? t.ownerType === "team"
			? maps.teamsMap.get(t.ownerId as Id<"teams">)
			: maps.usersMap.get(t.ownerId as Id<"users">)
		: null;
	const assignee = t.assigneeId
		? (maps.usersMap.get(t.assigneeId) ?? null)
		: null;
	const phase = t.phaseId ? (maps.phasesMap.get(t.phaseId) ?? null) : null;
	const labels = t.labelIds
		.map((lid: Id<"labels">) => maps.labelsMap.get(lid))
		.filter(Boolean) as LabelRef[];

	const parent = resolveTaskParent(t);

	let parentDisplayName: string | null;
	if (opts.parentDisplayNameOverride !== undefined) {
		parentDisplayName = opts.parentDisplayNameOverride;
	} else {
		parentDisplayName = parent
			? parent.type === "task"
				? (maps.taskIdToTitle.get(parent.linkedId) ?? null)
				: (maps.competitionIdToName.get(parent.linkedId) ?? null)
			: null;
	}

	const combinedTeamsMap = new Map(maps.teamsMap);
	for (const [key, value] of maps.approvalTeamsMap) {
		combinedTeamsMap.set(key, value);
	}
	const { requiredApprovalBy, approvedBy } = resolveApprovalData(
		ctx,
		t.requiredApprovalIds ?? [],
		t.approvedByIds ?? [],
		maps.usersMap,
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
}
