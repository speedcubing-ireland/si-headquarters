import { useQuery, useMutation } from "convex/react";
import type { OptimisticLocalStore } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
	Task,
	User,
	Team,
	TaskLabel,
	Competition,
	Comment,
	Reminder,
} from "@/data/types-new";

export { usePhases } from "./convex/use-phases";
export { useLabels, useLabelMutations } from "./convex/use-labels";
export { useUsers } from "./convex/use-users";
export { useTeams } from "./convex/use-teams";

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
	return data;
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

export const useCompetitions = () => {
	const competitions = useQuery(api.competitions.listForUI);
	return {
		competitions: competitions ?? [],
		isLoading: competitions === undefined,
	};
};

export const useCompetition = (competitionId: Id<"competitions"> | null) => {
	const data = useQuery(
		api.competitions.getForUI,
		competitionId ? { competitionId } : "skip",
	);
	if (competitionId == null) return null;
	return data;
};

export const useIsDirector = () => ({
	isDirector: useQuery(api.admin.isDirector, {}) === true,
	isLoading: useQuery(api.admin.isDirector, {}) === undefined,
});

export const useAdminMembersAndTeams = () => {
	const data = useQuery(api.admin.listMembersAndTeams, {});
	return {
		users: data?.users ?? [],
		teams: data?.teams ?? [],
		isLoading: data === undefined,
	};
};

export const useCommentsForTask = (
	taskId: Id<"tasks"> | Id<"competitionUpdates"> | null,
) => {
	const comments = useQuery(
		api.comments.listForUI,
		taskId ? { parentType: "task", parentId: taskId } : "skip",
	);
	return {
		comments: comments ?? [],
		isLoading: comments === undefined,
	};
};

export const useCommentsForSearch = () => {
	const comments = useQuery(api.comments.listRecentForSearch, { limit: 200 });
	return {
		comments: comments ?? [],
		isLoading: comments === undefined,
	};
};

export const useActivityForTask = (taskId: string | null) => {
	const activities = useQuery(
		api.activity.listForEntity,
		taskId ? { entityType: "task", entityId: taskId } : "skip",
	);
	return {
		activities: activities ?? [],
		isLoading: activities === undefined,
	};
};

export const useRecentActivity = (limit = 50) => {
	const activities = useQuery(api.activity.listRecentForUser, { limit });
	return {
		activities: activities ?? [],
		isLoading: activities === undefined,
	};
};

export const useGlobalActivity = (limit = 50) => {
	const activities = useQuery(api.activity.listRecent, { limit });
	return {
		activities: activities ?? [],
		isLoading: activities === undefined,
	};
};

export const useNotifications = () => {
	const notifications = useQuery(api.notifications.listForUser, {});
	return {
		notifications: notifications ?? [],
		isLoading: notifications === undefined,
	};
};

export const useUnreadCount = () =>
	useQuery(api.notifications.getUnreadCount, {});

export const useReminders = () => {
	const reminders = useQuery(api.reminders.listForUser, {});
	return {
		reminders: reminders ?? [],
		isLoading: reminders === undefined,
	};
};

export const usePendingReminders = () => {
	const reminders = useQuery(api.reminders.listPendingForUser, {});
	return {
		reminders: reminders ?? [],
		isLoading: reminders === undefined,
	};
};

export const usePendingRemindersForTask = (taskId: string | null) => {
	const reminders = useQuery(
		api.reminders.listPendingForTask,
		taskId ? { taskId } : "skip",
	);
	return {
		reminders: reminders ?? [],
		isLoading: reminders === undefined,
	};
};

const getOwnerFields = (owner: Team | User | null) =>
	owner
		? "members" in owner
			? { ownerId: owner.id, ownerType: "team" as const }
			: { ownerId: owner.id, ownerType: "user" as const }
		: {};

interface TaskMutations {
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
	approveTask: (taskId: Id<"tasks">) => Promise<null>;
	unapproveTask: (taskId: Id<"tasks">) => Promise<null>;
}

function competitionIdFromParent(
	parent: Task["parent"],
): Id<"competitions"> | null {
	if (!parent || parent.type !== "competition") return null;
	return parent.linkedId;
}

/** Optimistic update helper; IDs flow from Convex (task.id, parent.linkedId). */
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

		const compId = competitionIdFromParent(updatedTask?.parent ?? null);
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
	).withOptimisticUpdate((store, { taskId, approverId }) => {
		const current = store.getQuery(api.tasks.getForUI, { taskId });
		if (!current) return;
		const currentRequired = current.requiredApprovalBy ?? [];
		if (currentRequired.some((a) => a.id === approverId)) return;
		patchTaskInQueries(store, taskId, {
			...current,
			requiredApprovalBy: [...currentRequired],
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
			requiredApprovalBy: (current.requiredApprovalBy ?? []).filter(
				(a) => a.id !== approverId,
			),
			updatedAt: new Date().toISOString(),
		} satisfies Task);
	});

	const approveTaskMutation = useMutation(
		api.tasks.approveTask,
	).withOptimisticUpdate((store, { taskId }) => {
		const current = store.getQuery(api.tasks.getForUI, { taskId });
		const users = store.getQuery(api.users.listUsers);
		const currentUser = users?.[0];
		if (!current || !currentUser) return;

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
		const users = store.getQuery(api.users.listUsers);
		const currentUser = users?.[0];
		if (!current || !currentUser) return;

		patchTaskInQueries(store, taskId, {
			...current,
			approvedBy: (current.approvedBy ?? []).filter(
				(a) => a.id !== currentUser.id,
			),
			updatedAt: new Date().toISOString(),
		} satisfies Task);
	});

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
				updates: {
					...(updates.title !== undefined && { title: updates.title }),
					...(updates.description !== undefined && {
						description: updates.description,
					}),
					...(updates.status !== undefined && { status: updates.status }),
					...(updates.priority !== undefined && { priority: updates.priority }),
					...(updates.dueDate !== undefined && {
						dueDate: updates.dueDate === null ? null : updates.dueDate,
					}),
					...(updates.assignee !== undefined && {
						assigneeId: updates.assignee?.id ?? null,
					}),
					...(updates.owner !== undefined && {
						ownerId: ownerId ?? null,
						ownerType: ownerType ?? undefined,
					}),
					...(updates.labels !== undefined && {
						labelIds: updates.labels.map((l) => l.id),
					}),
					...(updates.resources !== undefined && {
						resources: updates.resources,
					}),
				},
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
			removeRequiredApproverMutation({
				taskId,
				approverKey,
			}),
		approveTask: (taskId) => approveTaskMutation({ taskId }),
		unapproveTask: (taskId) => unapproveTaskMutation({ taskId }),
	};
}

export function useCompetitionMutations() {
	const createCompetition = useMutation(api.competitions.create);
	const updateCompetitionMutation = useMutation(api.competitions.update);
	const removeCompetitionMutation = useMutation(api.competitions.remove);

	return {
		addCompetition: async (
			payload: Omit<
				Competition,
				"id" | "tasks" | "progressUpdates" | "createdAt" | "updatedAt"
			>,
		) => {
			const id = await createCompetition({
				name: payload.name,
				description: payload.description,
				compStart: payload.compStart,
				compEnd: payload.compEnd,
				compLeadId: payload.compLead?.id ?? undefined,
				leadDelegateId: payload.leadDelegate?.id ?? undefined,
				organiserIds: payload.organisers.map((u) => u.id),
				compSheet: payload.compSheet ?? undefined,
			});
			return {
				...payload,
				id,
				tasks: [],
				progressUpdates: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			} satisfies Competition;
		},

		updateCompetition: (
			id: Id<"competitions">,
			updates: Partial<
				Pick<
					Competition,
					| "name"
					| "description"
					| "compStart"
					| "compEnd"
					| "compLead"
					| "leadDelegate"
					| "organisers"
					| "compSheet"
				>
			> & { currentPhaseId?: Id<"phases"> | null },
		) =>
			updateCompetitionMutation({
				competitionId: id,
				updates: {
					...(updates.name !== undefined && { name: updates.name }),
					...(updates.description !== undefined && {
						description: updates.description,
					}),
					...(updates.compStart !== undefined && {
						compStart: updates.compStart,
					}),
					...(updates.compEnd !== undefined && { compEnd: updates.compEnd }),
					...(updates.compLead !== undefined && {
						compLeadId: updates.compLead?.id ?? null,
					}),
					...(updates.leadDelegate !== undefined && {
						leadDelegateId: updates.leadDelegate?.id ?? null,
					}),
					...(updates.organisers !== undefined && {
						organiserIds: updates.organisers.map((u) => u.id),
					}),
					...(updates.currentPhaseId !== undefined && {
						currentPhaseId: updates.currentPhaseId ?? undefined,
					}),
					...(updates.compSheet !== undefined && {
						compSheet: updates.compSheet ?? undefined,
					}),
				},
			}),

		deleteCompetition: (id: Id<"competitions">) =>
			removeCompetitionMutation({ competitionId: id }),
	};
}

export function useCompetitionUpdateMutations() {
	const createUpdateMutation = useMutation(api.updates.create);
	const addReactionMutation = useMutation(api.updates.addReaction);

	return {
		createUpdate: (
			competitionId: Id<"competitions">,
			payload: {
				status: "on-track" | "at-risk" | "off-track";
				message?: string;
			},
		) =>
			createUpdateMutation({
				competitionId: competitionId,
				status: payload.status,
				message: payload.message,
			}),
		addReaction: (updateId: Id<"competitionUpdates">, emoji: string) =>
			addReactionMutation({
				updateId: updateId,
				emoji,
			}),
	};
}

export function useCommentMutations() {
	const createCommentMutation = useMutation(api.comments.create);
	const updateCommentMutation = useMutation(api.comments.update);
	const removeCommentMutation = useMutation(api.comments.remove);
	const toggleReactionMutation = useMutation(api.comments.toggleReaction);

	return {
		addComment: async (
			parentType: "task" | "update",
			parentId: Id<"tasks"> | Id<"competitionUpdates">,
			content: string,
			parentCommentId: Id<"comments"> | null,
			author: User,
		) => {
			const id = await createCommentMutation({
				parentType,
				parentId,
				parentCommentId: parentCommentId ?? undefined,
				content,
			});
			return {
				id,
				parentType,
				parentId,
				parentCommentId,
				author,
				content,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				contentUpdatedAt: undefined,
				reactions: [],
			} satisfies Comment;
		},

		editComment: (commentId: Id<"comments">, content: string) =>
			updateCommentMutation({
				commentId: commentId,
				content,
			}),
		deleteComment: (commentId: Id<"comments">) =>
			removeCommentMutation({ commentId: commentId }),
		addReaction: (commentId: Id<"comments">, emoji: string) =>
			toggleReactionMutation({ commentId: commentId, emoji }),
	};
}

export function useNotificationMutations() {
	const markReadMutation = useMutation(api.notifications.markRead);
	const markArchivedMutation = useMutation(api.notifications.markArchived);
	const markAllReadMutation = useMutation(api.notifications.markAllRead);
	const dismissMutation = useMutation(api.notifications.dismiss);

	return {
		markNotificationRead: (notificationId: Id<"notifications">) =>
			markReadMutation({
				notificationId: notificationId,
			}),
		markNotificationArchived: (notificationId: Id<"notifications">) =>
			markArchivedMutation({
				notificationId: notificationId,
			}),
		markAllNotificationsRead: () => markAllReadMutation({}),
		dismissNotification: (notificationId: Id<"notifications">) =>
			dismissMutation({
				notificationId: notificationId,
			}),
	};
}

export function useAdminMemberMutations() {
	const updateTeamMembers = useMutation(api.admin.updateTeamMembers);
	return {
		updateTeamMembers: (teamId: Id<"teams">, memberIds: Id<"users">[]) =>
			updateTeamMembers({ teamId, memberIds }),
	};
}

export function useReminderMutations() {
	const createMutation = useMutation(api.reminders.create);
	const cancelMutation = useMutation(api.reminders.cancel);
	const dismissMutation = useMutation(api.reminders.dismiss);
	const snoozeMutation = useMutation(api.reminders.snooze);
	const rescheduleMutation = useMutation(api.reminders.reschedule);

	return {
		addReminder: (
			payload: Omit<Reminder, "id" | "createdAt" | "updatedAt" | "userId">,
		) =>
			createMutation({
				entityId: payload.entityId,
				type: payload.type,
				remindAt: payload.remindAt,
				recurringPattern: payload.recurringPattern,
				recurringConfig: payload.recurringConfig,
				endDate: payload.endDate,
				message: payload.message,
				priority: payload.priority,
				metadata: payload.metadata ?? {},
			}),
		cancelReminder: (reminderId: Id<"reminders">) =>
			cancelMutation({ reminderId: reminderId }),
		dismissReminder: (reminderId: Id<"reminders">) =>
			dismissMutation({ reminderId: reminderId }),
		snoozeReminder: (reminderId: Id<"reminders">, snoozeUntil: string) =>
			snoozeMutation({
				reminderId: reminderId,
				snoozeUntil,
			}),
		rescheduleReminder: (reminderId: Id<"reminders">, remindAt: string) =>
			rescheduleMutation({
				reminderId: reminderId,
				remindAt,
			}),
	};
}

export const buildOneTimeReminderPayload = (
	taskId: Id<"tasks">,
	remindAt: string,
	message?: string,
): Omit<Reminder, "id" | "createdAt" | "updatedAt" | "userId"> => ({
	entityId: taskId,
	entityType: "task",
	type: "one_time",
	remindAt,
	recurringPattern: undefined,
	recurringConfig: undefined,
	endDate: undefined,
	triggeredAt: undefined,
	dismissedAt: undefined,
	status: "pending",
	priority: "normal",
	metadata: {},
	message: message ?? "",
});
