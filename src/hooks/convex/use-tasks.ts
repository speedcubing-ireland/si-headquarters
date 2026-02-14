import { useQuery, useMutation } from "convex/react";
import type { OptimisticLocalStore } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Task, User, Team, TaskLabel } from "@/data/types-new";
import { pickDefined } from "@/lib/utils";

export const useTasks = (archived = false) => {
	const tasks = useQuery(api.tasks.listForUI, { archived });
	return {
		tasks: tasks ?? [],
		isLoading: tasks === undefined,
	};
};

export const useTask = (taskId: Id<"tasks"> | null) => {
	const data = useQuery(api.tasks.getForUI, taskId ? { taskId } : "skip");
	if (taskId == null) return null;
	return data ?? null;
};

export const useTasksForCompetition = (
	competitionId: Id<"competitions"> | null,
) => {
	const tasks = useQuery(
		api.tasks.listForUI,
		competitionId ? { archived: false, competitionId } : "skip",
	);
	return {
		tasks: tasks ?? [],
		isLoading: tasks === undefined,
	};
};

const getOwnerFields = (owner: Team | User | null) =>
	owner
		? "members" in owner
			? { ownerId: owner.id, ownerType: "team" as const }
			: { ownerId: owner.id, ownerType: "user" as const }
		: {};

export interface TaskMutations {
	addTask: (payload: {
		parent: Task["parent"];
		title: string;
		description: string;
		owner: Team | User | null;
		assignee: User | null;
		phase: Task["phase"];
		status: Task["status"];
		priority: Task["priority"];
		dueDate: string | null;
		labels: TaskLabel[];
		resources?: Task["resources"];
		requiredApprovalIds?: string[];
		parentCompetitionId?: Id<"competitions">;
	}) => Promise<Task>;
	updateTask: (
		taskId: Id<"tasks">,
		updates: Partial<{
			title: string;
			description: string;
			status: Task["status"];
			priority: Task["priority"];
			assignee: User | null;
			owner: Team | User | null;
			labels: TaskLabel[];
			dueDate: string | null;
			resources: Task["resources"];
		}>,
	) => Promise<null>;
	bulkUpdateTasks: (
		taskIds: Id<"tasks">[],
		updates: Parameters<TaskMutations["updateTask"]>[1],
	) => Promise<null>;
	archiveTasks: (taskIds: Id<"tasks">[]) => Promise<null>;
	unarchiveTask: (taskId: Id<"tasks">) => Promise<null>;
	bulkUnarchiveTasks: (taskIds: Id<"tasks">[]) => Promise<null>;
	deleteTasks: (taskIds: Id<"tasks">[]) => Promise<null>;
	permanentlyDeleteTasks: (taskIds: Id<"tasks">[]) => Promise<null>;
	deleteTask: (taskId: Id<"tasks">) => Promise<null>;
	addRequiredApprover: (
		taskId: Id<"tasks">,
		approver: Team | User,
	) => Promise<null>;
	removeRequiredApprover: (
		taskId: Id<"tasks">,
		approverKey: string,
	) => Promise<null>;
	addBlockingRelation: (
		blockedTaskId: Id<"tasks">,
		blockingTaskId: Id<"tasks">,
	) => Promise<null>;
	removeBlockingRelation: (
		blockedTaskId: Id<"tasks">,
		blockingTaskId: Id<"tasks">,
	) => Promise<null>;
	approveTask: (taskId: Id<"tasks">) => Promise<null>;
	unapproveTask: (taskId: Id<"tasks">) => Promise<null>;
}

function competitionIdFromParent(
	parent: Task["parent"],
): Id<"competitions"> | null {
	if (!parent || parent.type !== "competition") return null;
	return parent.linkedId;
}

const patchTaskInQueries = (
	store: OptimisticLocalStore,
	taskId: Id<"tasks">,
	updatedTask: Task,
) => {
	store.setQuery(api.tasks.getForUI, { taskId }, updatedTask);

	const archivedOptions = [false, true] as const;
	for (const archived of archivedOptions) {
		const list = store.getQuery(api.tasks.listForUI, { archived }) as
			| Task[]
			| undefined;
		if (!list) continue;
		const idx = list.findIndex((t) => t.id === taskId);
		if (idx < 0) continue;
		const nextList = [...list];
		nextList[idx] = updatedTask;
		store.setQuery(api.tasks.listForUI, { archived }, nextList);

		const compId = competitionIdFromParent(updatedTask.parent);
		if (compId != null) {
			const compList = store.getQuery(api.tasks.listForUI, {
				archived: false,
				competitionId: compId,
			});
			if (compList) {
				const compIdx = (compList as Task[]).findIndex((t) => t.id === taskId);
				if (compIdx >= 0) {
					const nextCompList = [...compList];
					nextCompList[compIdx] = updatedTask;
					store.setQuery(
						api.tasks.listForUI,
						{ archived: false, competitionId: compId },
						nextCompList,
					);
				}
			}
		}
	}
};

export function useTaskMutations(): TaskMutations {
	const createTask = useMutation(api.tasks.create);
	const archiveTasksMutation = useMutation(api.tasks.archive);
	const unarchiveTasksMutation = useMutation(api.tasks.unarchive);
	const removeTasksMutation = useMutation(api.tasks.remove);

	const updateTaskMutation = useMutation(api.tasks.update).withOptimisticUpdate(
		(store, { taskId, updates }) => {
			const current = store.getQuery(api.tasks.getForUI, { taskId });
			if (!current) return;
			const next = {
				...current,
				...updates,
				updatedAt: new Date().toISOString(),
			} satisfies Task;
			patchTaskInQueries(store, taskId, next);
		},
	);

	const bulkUpdateTasksMutation = useMutation(api.tasks.bulkUpdate);

	const addRequiredApproverMutation = useMutation(
		api.tasks.addRequiredApprover,
	).withOptimisticUpdate((store, { taskId }) => {
		const current = store.getQuery(api.tasks.getForUI, { taskId });
		if (!current) return;
		patchTaskInQueries(store, taskId, {
			...current,
			updatedAt: new Date().toISOString(),
		} satisfies Task);
	});

	const removeRequiredApproverMutation = useMutation(
		api.tasks.removeRequiredApprover,
	).withOptimisticUpdate((store, { taskId, approverKey }) => {
		const current = store.getQuery(api.tasks.getForUI, { taskId });
		if (!current) return;
		const approverId = approverKey.includes(":")
			? approverKey.split(":")[1]
			: approverKey;
		patchTaskInQueries(store, taskId, {
			...current,
			requiredApprovalBy: current.requiredApprovalBy.filter(
				(a) => a.id !== approverId,
			),
			updatedAt: new Date().toISOString(),
		} satisfies Task);
	});

	const approveTaskMutation = useMutation(
		api.tasks.approveTask,
	).withOptimisticUpdate((store, { taskId }) => {
		const current = store.getQuery(api.tasks.getForUI, { taskId });
		const authUser = store.getQuery(api.users.getCurrentUser, {});
		if (!current || !authUser) return;
		const users = store.getQuery(api.users.listUsers) ?? [];
		const currentUser =
			users.find((user) => user.id === authUser._id) ??
			({
				id: authUser._id,
				name: authUser.name ?? "",
				avatarUrl: authUser.image ?? "",
			} satisfies User);

		const next = { ...current };
		if (!next.approvedBy?.some((a) => a.id === currentUser.id)) {
			next.approvedBy = [...(next.approvedBy ?? []), currentUser];
		}

		const approvedIds = new Set(next.approvedBy.map((a) => a.id));
		const isFullyApproved =
			next.requiredApprovalBy?.length > 0 &&
			next.requiredApprovalBy.every((r) =>
				"members" in r
					? r.members.some((m) => approvedIds.has(m.id))
					: approvedIds.has(r.id),
			);

		if (isFullyApproved && next.status === "awaiting-review") {
			next.status = "done";
		}
		next.updatedAt = new Date().toISOString();
		patchTaskInQueries(store, taskId, next satisfies Task);
	});

	const unapproveTaskMutation = useMutation(
		api.tasks.unapproveTask,
	).withOptimisticUpdate((store, { taskId }) => {
		const current = store.getQuery(api.tasks.getForUI, { taskId });
		const authUser = store.getQuery(api.users.getCurrentUser, {});
		const currentUserId = authUser?._id;
		if (!current || !currentUserId) return;

		patchTaskInQueries(store, taskId, {
			...current,
			approvedBy: current.approvedBy.filter((a) => a.id !== currentUserId),
			updatedAt: new Date().toISOString(),
		} satisfies Task);
	});

	const addBlockingRelationMutation = useMutation(
		api.tasks.addBlockingRelation,
	);
	const removeBlockingRelationMutation = useMutation(
		api.tasks.removeBlockingRelation,
	);

	return {
		addTask: async (payload) => {
			const { ownerId, ownerType } = getOwnerFields(payload.owner);
			const parentTaskId =
				payload.parent?.type === "task"
					? (payload.parent.linkedId as Id<"tasks">)
					: undefined;
			const parentCompetitionId =
				payload.parentCompetitionId ??
				(payload.parent?.type === "competition"
					? (payload.parent.linkedId as Id<"competitions">)
					: undefined);
			const id = await createTask({
				title: payload.title,
				description: payload.description,
				status: payload.status,
				priority: payload.priority,
				dueDate: payload.dueDate ?? undefined,
				parentTaskId,
				parentCompetitionId,
				phaseId: payload.phase?.id ? payload.phase.id : undefined,
				ownerId,
				ownerType,
				assigneeId: payload.assignee?.id ? payload.assignee.id : undefined,
				labelIds: payload.labels.map((l) => l.id),
				requiredApprovalIds: payload.requiredApprovalIds,
			});
			return {
				id,
				identifier: "",
				parent: payload.parent,
				parentDisplayName: null,
				competitionDisplayName: null,
				title: payload.title,
				description: payload.description,
				owner: payload.owner,
				assignee: payload.assignee,
				phase: payload.phase,
				status: payload.status,
				priority: payload.priority,
				dueDate: payload.dueDate,
				requiredApprovalBy: [],
				approvedBy: [],
				labels: payload.labels,
				blockedBy: [],
				blocks: [],
				unresolvedBlockerCount: 0,
				isBlocked: false,
				resources: [],
				subTasks: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				archivedAt: null,
			} satisfies Task;
		},

		updateTask: (taskId, updates) => {
			const { ownerId, ownerType } = getOwnerFields(updates.owner ?? null);
			return updateTaskMutation({
				taskId,
				updates: pickDefined({
					title: updates.title,
					description: updates.description,
					status: updates.status,
					priority: updates.priority,
					dueDate:
						updates.dueDate !== undefined
							? updates.dueDate === null
								? null
								: updates.dueDate
							: undefined,
					assigneeId:
						updates.assignee !== undefined
							? (updates.assignee?.id ?? null)
							: undefined,
					...(updates.owner !== undefined && {
						ownerId: ownerId ?? null,
						ownerType: ownerType ?? undefined,
					}),
					labelIds:
						updates.labels !== undefined
							? updates.labels.map((l) => l.id)
							: undefined,
					resources: updates.resources,
				}),
			});
		},

		bulkUpdateTasks: (taskIds, updates) =>
			bulkUpdateTasksMutation({ taskIds, updates }),
		archiveTasks: (taskIds) => archiveTasksMutation({ taskIds }),
		unarchiveTask: (taskId) => unarchiveTasksMutation({ taskIds: [taskId] }),
		bulkUnarchiveTasks: (taskIds) => unarchiveTasksMutation({ taskIds }),
		deleteTasks: (taskIds) => removeTasksMutation({ taskIds }),
		permanentlyDeleteTasks: (taskIds) => removeTasksMutation({ taskIds }),
		deleteTask: (taskId) => removeTasksMutation({ taskIds: [taskId] }),
		addRequiredApprover: (taskId, approver) =>
			addRequiredApproverMutation({
				taskId,
				approverType: "members" in approver ? "team" : "user",
				approverId: approver.id,
			}),
		removeRequiredApprover: (taskId, approverKey) =>
			removeRequiredApproverMutation({ taskId, approverKey }),
		addBlockingRelation: (blockedTaskId, blockingTaskId) =>
			addBlockingRelationMutation({ blockedTaskId, blockingTaskId }),
		removeBlockingRelation: (blockedTaskId, blockingTaskId) =>
			removeBlockingRelationMutation({ blockedTaskId, blockingTaskId }),
		approveTask: (taskId) => approveTaskMutation({ taskId }),
		unapproveTask: (taskId) => unapproveTaskMutation({ taskId }),
	};
}
