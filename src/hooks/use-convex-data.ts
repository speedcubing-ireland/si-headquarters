import { useQuery, useMutation } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type {
	Task,
	User,
	Team,
	TaskLabel,
	Competition,
	CompetitionPhase,
	Comment,
	ActivityEntry,
	Notification,
	Reminder,
} from "@/data/types-new";

export function usePhases(): {
	phases: CompetitionPhase[];
	isLoading: boolean;
} {
	const data = useQuery(api.phases.list, {});
	const phases = useMemo<CompetitionPhase[]>(
		() =>
			(data ?? []).map((p) => ({
				id: p._id,
				name: p.name,
				description: p.description,
			})),
		[data],
	);
	return {
		phases,
		isLoading: data === undefined,
	};
}

export function useTasks(archived = false): {
	tasks: Task[];
	isLoading: boolean;
} {
	const data = useQuery(api.tasks.listForUI, { archived });
	return {
		tasks: (data ?? []) as unknown as Task[],
		isLoading: data === undefined,
	};
}

export function useTask(
	taskId: Id<"tasks"> | string | null,
): Task | undefined | null {
	const data = useQuery(
		api.tasks.getForUI,
		taskId ? { taskId: taskId as Id<"tasks"> } : "skip",
	);
	if (taskId == null) return null;
	return data === undefined ? undefined : (data as unknown as Task);
}

export function useTasksForCompetition(competitionId: string | null): {
	tasks: Task[];
	isLoading: boolean;
} {
	const data = useQuery(
		api.tasks.listForUI,
		competitionId ? { archived: false, competitionId } : "skip",
	);
	return {
		tasks: (data ?? []) as unknown as Task[],
		isLoading: data === undefined,
	};
}

export function useLabels(): { labels: TaskLabel[]; isLoading: boolean } {
	const data = useQuery(api.labels.list);
	const labels = useMemo(
		() =>
			(data ?? []).map((l) => ({
				id: l._id,
				name: l.name,
				color: l.color,
			})),
		[data],
	);
	return {
		labels,
		isLoading: data === undefined,
	};
}

export function useUsers(): { users: User[]; isLoading: boolean } {
	const data = useQuery(api.users.listUsers);
	return {
		users: (data ?? []) as User[],
		isLoading: data === undefined,
	};
}

export function useTeams(): { teams: Team[]; isLoading: boolean } {
	const teamsRaw = useQuery(api.teams.list);
	const usersData = useQuery(api.users.listUsers);
	const teams = useMemo(() => {
		if (teamsRaw == null || usersData == null) return [];
		const users = usersData as User[];
		const userMap = new Map(users.map((u) => [u.id, u]));
		return teamsRaw.map((t) => ({
			id: t._id,
			name: t.name,
			members: t.memberIds
				.map((id) => userMap.get(id))
				.filter((u): u is User => u != null),
		}));
	}, [teamsRaw, usersData]);
	return {
		teams,
		isLoading: teamsRaw === undefined || usersData === undefined,
	};
}

function toOwnerIdOwnerType(owner: Team | User | null): {
	ownerId?: string;
	ownerType?: "user" | "team";
} {
	if (!owner) return {};
	return "members" in owner
		? { ownerId: owner.id, ownerType: "team" as const }
		: { ownerId: owner.id, ownerType: "user" as const };
}

export function useTaskMutations() {
	const createTask = useMutation(api.tasks.create);

	function patchTaskInQueries(
		localStore: Parameters<
			Parameters<
				ReturnType<
					typeof useMutation<typeof api.tasks.update>
				>["withOptimisticUpdate"]
			>[0]
		>[0],
		taskId: string,
		updatedTask: Parameters<typeof localStore.setQuery>[2],
	) {
		localStore.setQuery(
			api.tasks.getForUI,
			{ taskId: taskId as Id<"tasks"> },
			updatedTask,
		);

		const patchList = (listArgs: {
			archived: boolean;
			competitionId?: string;
		}) => {
			const list = localStore.getQuery(api.tasks.listForUI, listArgs);
			if (!list) return;
			const idx = list.findIndex((t) => t.id === taskId);
			if (idx < 0) return;
			const nextList = [...list];
			nextList[idx] = updatedTask;
			localStore.setQuery(api.tasks.listForUI, listArgs, nextList);
		};
		for (const archived of [false, true] as const) {
			patchList({ archived });
			if (
				typeof updatedTask === "object" &&
				updatedTask !== null &&
				"parent" in updatedTask &&
				updatedTask.parent?.type === "competition"
			) {
				patchList({
					archived: false,
					competitionId: updatedTask.parent.linkedId,
				});
			}
		}
	}

	const updateTaskMutation = useMutation(api.tasks.update).withOptimisticUpdate(
		(localStore, args) => {
			const current = localStore.getQuery(api.tasks.getForUI, {
				taskId: args.taskId,
			});
			if (!current || !args.updates) return;
			const u = args.updates;
			const next = { ...current };
			if (u.title !== undefined) next.title = u.title;
			if (u.description !== undefined) next.description = u.description;
			if (u.status !== undefined) next.status = u.status;
			if (u.priority !== undefined) next.priority = u.priority;
			if (u.dueDate !== undefined) next.dueDate = u.dueDate;
			next.updatedAt = new Date().toISOString();
			patchTaskInQueries(localStore, args.taskId, next);
		},
	);
	const archiveTasksMutation = useMutation(api.tasks.archive);
	const unarchiveTasksMutation = useMutation(api.tasks.unarchive);
	const bulkUpdateTasksMutation = useMutation(api.tasks.bulkUpdate);
	const removeTasksMutation = useMutation(api.tasks.remove);

	const addRequiredApproverMutation = useMutation(
		api.tasks.addRequiredApprover,
	).withOptimisticUpdate((localStore, args) => {
		const current = localStore.getQuery(api.tasks.getForUI, {
			taskId: args.taskId,
		});
		if (!current) return;

		const currentRequired = current.requiredApprovalBy ?? [];
		const approverExists = currentRequired.some(
			(a) => a.id === args.approverId,
		);
		if (approverExists) return;

		const next = { ...current };
		next.requiredApprovalBy = [...currentRequired];
		next.updatedAt = new Date().toISOString();
		patchTaskInQueries(localStore, args.taskId, next);
	});

	const removeRequiredApproverMutation = useMutation(
		api.tasks.removeRequiredApprover,
	).withOptimisticUpdate((localStore, args) => {
		const current = localStore.getQuery(api.tasks.getForUI, {
			taskId: args.taskId,
		});
		if (!current) return;

		const approverId = args.approverKey.includes(":")
			? args.approverKey.split(":")[1]
			: args.approverKey;
		const next = { ...current };
		next.requiredApprovalBy = (current.requiredApprovalBy ?? []).filter(
			(a) => a.id !== approverId,
		);
		next.updatedAt = new Date().toISOString();
		patchTaskInQueries(localStore, args.taskId, next);
	});

	const approveTaskMutation = useMutation(
		api.tasks.approveTask,
	).withOptimisticUpdate((localStore, args) => {
		const current = localStore.getQuery(api.tasks.getForUI, {
			taskId: args.taskId,
		});
		if (!current) return;

		// Get current user from users query
		const users = localStore.getQuery(api.users.listUsers);
		const currentUser = users?.[0];
		if (!currentUser) return;

		const next = { ...current };
		const currentApproved = current.approvedBy ?? [];
		const alreadyApproved = currentApproved.some(
			(a) => a.id === currentUser.id,
		);
		if (!alreadyApproved) {
			next.approvedBy = [...currentApproved, currentUser];
		}

		// Check if fully approved and should auto-move to done
		const required = current.requiredApprovalBy ?? [];
		const approvedIds = new Set(next.approvedBy.map((a) => a.id));
		const isFullyApproved =
			required.length > 0 &&
			required.every((r) => {
				if ("members" in r) {
					// Team: check if any member approved
					return r.members.some((m) => approvedIds.has(m.id));
				}
				return approvedIds.has(r.id);
			});

		if (
			isFullyApproved &&
			required.length > 0 &&
			next.status === "awaiting-review"
		) {
			next.status = "done";
		}

		next.updatedAt = new Date().toISOString();
		patchTaskInQueries(localStore, args.taskId, next);
	});

	const unapproveTaskMutation = useMutation(
		api.tasks.unapproveTask,
	).withOptimisticUpdate((localStore, args) => {
		const current = localStore.getQuery(api.tasks.getForUI, {
			taskId: args.taskId,
		});
		if (!current) return;

		const users = localStore.getQuery(api.users.listUsers);
		const currentUser = users?.[0];
		if (!currentUser) return;

		const next = { ...current };
		next.approvedBy = (current.approvedBy ?? []).filter(
			(a) => a.id !== currentUser.id,
		);
		next.updatedAt = new Date().toISOString();
		patchTaskInQueries(localStore, args.taskId, next);
	});

	return {
		addTask: async (payload: {
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
			/** For sub-tasks under a competition parent, so they appear in competition task list */
			parentCompetitionId?: string;
		}) => {
			const { ownerId, ownerType } = toOwnerIdOwnerType(payload.owner);
			const parentTaskId =
				payload.parent?.type === "task"
					? (payload.parent.linkedId as Id<"tasks">)
					: undefined;
			const parentCompetitionId =
				payload.parentCompetitionId ??
				(payload.parent?.type === "competition"
					? payload.parent.linkedId
					: undefined);
			const phaseId: Id<"phases"> | undefined =
				payload.phase && "id" in payload.phase
					? (payload.phase.id as Id<"phases">)
					: undefined;
			const id = await createTask({
				title: payload.title,
				description: payload.description,
				status: payload.status,
				priority: payload.priority,
				dueDate: payload.dueDate ?? undefined,
				parentTaskId,
				parentCompetitionId,
				phaseId,
				ownerId,
				ownerType,
				assigneeId: payload.assignee
					? (payload.assignee.id as Id<"users">)
					: undefined,
				labelIds: payload.labels.map((l) => l.id as Id<"labels">),
				requiredApprovalIds: payload.requiredApprovalIds,
			});
			return {
				id,
				identifier: "",
				parent: payload.parent,
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
			} as Task;
		},

		updateTask: async (
			taskId: string,
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
		) => {
			const patch: Record<string, unknown> = {};
			if (updates.title !== undefined) patch.title = updates.title;
			if (updates.description !== undefined)
				patch.description = updates.description;
			if (updates.status !== undefined) patch.status = updates.status;
			if (updates.priority !== undefined) patch.priority = updates.priority;
			if (updates.dueDate !== undefined)
				patch.dueDate = updates.dueDate === null ? null : updates.dueDate;
			if (updates.assignee !== undefined)
				patch.assigneeId = updates.assignee
					? (updates.assignee.id as Id<"users">)
					: null;
			if (updates.owner !== undefined) {
				const { ownerId, ownerType } = toOwnerIdOwnerType(updates.owner);
				patch.ownerId = ownerId ?? null;
				patch.ownerType = ownerType ?? null;
			}
			if (updates.labels !== undefined)
				patch.labelIds = updates.labels.map((l) => l.id as Id<"labels">);
			if (updates.resources !== undefined) patch.resources = updates.resources;
			await updateTaskMutation({
				taskId: taskId as Id<"tasks">,
				updates: patch as Parameters<typeof updateTaskMutation>[0]["updates"],
			});
		},

		bulkUpdateTasks: async (
			taskIds: string[],
			updates: Partial<{
				status: Task["status"];
				priority: Task["priority"];
				assignee: User | null;
				owner: Team | User | null;
				labels: TaskLabel[];
				dueDate: string | null;
				resources: Task["resources"];
			}>,
		) => {
			if (taskIds.length === 0) return;

			const patch: Record<string, unknown> = {};
			if (updates.status !== undefined) patch.status = updates.status;
			if (updates.priority !== undefined) patch.priority = updates.priority;
			if (updates.dueDate !== undefined)
				patch.dueDate = updates.dueDate === null ? null : updates.dueDate;
			if (updates.assignee !== undefined)
				patch.assigneeId = updates.assignee
					? (updates.assignee.id as Id<"users">)
					: null;
			if (updates.owner !== undefined) {
				const { ownerId, ownerType } = toOwnerIdOwnerType(updates.owner);
				patch.ownerId = ownerId ?? null;
				patch.ownerType = ownerType ?? null;
			}
			if (updates.labels !== undefined)
				patch.labelIds = updates.labels.map((l) => l.id as Id<"labels">);
			if (updates.resources !== undefined) patch.resources = updates.resources;

			await bulkUpdateTasksMutation({
				taskIds: taskIds as Id<"tasks">[],
				updates: patch as Parameters<
					typeof bulkUpdateTasksMutation
				>[0]["updates"],
			});
		},

		archiveTasks: async (taskIds: string[]) => {
			await archiveTasksMutation({ taskIds: taskIds as Id<"tasks">[] });
		},

		unarchiveTask: async (taskId: string) => {
			await unarchiveTasksMutation({ taskIds: [taskId as Id<"tasks">] });
		},

		bulkUnarchiveTasks: async (taskIds: string[]) => {
			await unarchiveTasksMutation({ taskIds: taskIds as Id<"tasks">[] });
		},

		deleteTasks: async (taskIds: string[]) => {
			await removeTasksMutation({ taskIds: taskIds as Id<"tasks">[] });
		},

		permanentlyDeleteTasks: async (taskIds: string[]) => {
			await removeTasksMutation({ taskIds: taskIds as Id<"tasks">[] });
		},

		deleteTask: async (taskId: string) => {
			await removeTasksMutation({ taskIds: [taskId as Id<"tasks">] });
		},

		addRequiredApprover: async (
			taskId: string,
			approver: Team | User,
			_actor?: User,
		) => {
			const approverType = "members" in approver ? "team" : "user";
			await addRequiredApproverMutation({
				taskId: taskId as Id<"tasks">,
				approverType,
				approverId: approver.id,
			});
		},

		removeRequiredApprover: async (
			taskId: string,
			approverKey: string,
			_actor?: User,
		) => {
			await removeRequiredApproverMutation({
				taskId: taskId as Id<"tasks">,
				approverKey,
			});
		},

		approveTask: async (taskId: string, _actor: User) => {
			await approveTaskMutation({ taskId: taskId as Id<"tasks"> });
		},

		unapproveTask: async (taskId: string, _actor: User) => {
			await unapproveTaskMutation({ taskId: taskId as Id<"tasks"> });
		},
	};
}

export function useCompetitions(): {
	competitions: Competition[];
	isLoading: boolean;
} {
	const data = useQuery(api.competitions.listForUI);
	return {
		competitions: (data ?? []) as unknown as Competition[],
		isLoading: data === undefined,
	};
}

export function useIsDirector(): { isDirector: boolean; isLoading: boolean } {
	const data = useQuery(api.admin.isDirector, {});
	return {
		isDirector: data === true,
		isLoading: data === undefined,
	};
}

export type AdminUser = {
	id: Id<"users">;
	name: string;
	avatarUrl: string;
	teamIds: Id<"teams">[];
};

export type AdminTeam = {
	id: Id<"teams">;
	name: string;
	memberIds: Id<"users">[];
};

export function useAdminMembersAndTeams(): {
	users: AdminUser[];
	teams: AdminTeam[];
	isLoading: boolean;
} {
	const data = useQuery(api.admin.listMembersAndTeams, {});
	return {
		users: (data?.users ?? []) as AdminUser[],
		teams: (data?.teams ?? []) as AdminTeam[],
		isLoading: data === undefined,
	};
}

export function useAdminMemberMutations() {
	const updateTeamMembers = useMutation(api.admin.updateTeamMembers);
	return {
		updateTeamMembers: async (
			teamId: Id<"teams">,
			memberIds: Id<"users">[],
		) => {
			await updateTeamMembers({ teamId, memberIds });
		},
	};
}

export function useCompetition(
	competitionId: string | null,
): Competition | undefined | null {
	const data = useQuery(
		api.competitions.getForUI,
		competitionId
			? { competitionId: competitionId as Id<"competitions"> }
			: "skip",
	);
	if (competitionId == null) return null;
	return data === undefined ? undefined : (data as unknown as Competition);
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
				compLeadId: payload.compLead
					? (payload.compLead.id as Id<"users">)
					: undefined,
				leadDelegateId: payload.leadDelegate
					? (payload.leadDelegate.id as Id<"users">)
					: undefined,
				organiserIds: payload.organisers.map((u) => u.id as Id<"users">),
				compSheet: payload.compSheet ?? undefined,
			});
			return {
				...payload,
				id,
				tasks: [],
				progressUpdates: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			} as Competition;
		},

		updateCompetition: async (
			id: string,
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
					| "currentPhaseIdx"
					| "compSheet"
				>
			>,
		) => {
			const patch: Record<string, unknown> = {};
			if (updates.name !== undefined) patch.name = updates.name;
			if (updates.description !== undefined)
				patch.description = updates.description;
			if (updates.compStart !== undefined) patch.compStart = updates.compStart;
			if (updates.compEnd !== undefined) patch.compEnd = updates.compEnd;
			if (updates.compLead !== undefined)
				patch.compLeadId = updates.compLead
					? (updates.compLead.id as Id<"users">)
					: null;
			if (updates.leadDelegate !== undefined)
				patch.leadDelegateId = updates.leadDelegate
					? (updates.leadDelegate.id as Id<"users">)
					: null;
			if (updates.organisers !== undefined)
				patch.organiserIds = updates.organisers.map((u) => u.id as Id<"users">);
			if (updates.currentPhaseIdx !== undefined)
				patch.currentPhaseIdx = updates.currentPhaseIdx;
			if (
				(updates as { currentPhaseId?: string }).currentPhaseId !== undefined
			) {
				patch.currentPhaseId = (updates as { currentPhaseId?: string })
					.currentPhaseId
					? ((updates as { currentPhaseId?: string })
							.currentPhaseId as Id<"phases">)
					: null;
			}
			if (updates.compSheet !== undefined)
				patch.compSheet = updates.compSheet ?? null;
			await updateCompetitionMutation({
				competitionId: id as Id<"competitions">,
				updates: patch as Parameters<
					typeof updateCompetitionMutation
				>[0]["updates"],
			});
		},

		deleteCompetition: async (id: string) => {
			await removeCompetitionMutation({
				competitionId: id as Id<"competitions">,
			});
		},
	};
}

export function useCompetitionUpdateMutations() {
	const createUpdateMutation = useMutation(api.updates.create);
	const addReactionMutation = useMutation(api.updates.addReaction);

	return {
		createUpdate: async (
			competitionId: string,
			payload: {
				status: "on-track" | "at-risk" | "off-track";
				message?: string;
			},
		) => {
			await createUpdateMutation({
				competitionId: competitionId as Id<"competitions">,
				status: payload.status,
				message: payload.message,
			});
		},
		addReaction: async (updateId: string, emoji: string) => {
			await addReactionMutation({
				updateId: updateId as Id<"competitionUpdates">,
				emoji,
			});
		},
	};
}

export function useCommentsForTask(taskId: string | null): {
	comments: Comment[];
	isLoading: boolean;
} {
	const data = useQuery(
		api.comments.listForUI,
		taskId ? { parentType: "task", parentId: taskId } : "skip",
	);
	return {
		comments: (data ?? []) as Comment[],
		isLoading: data === undefined,
	};
}

export function useCommentsForSearch(): {
	comments: Comment[];
	isLoading: boolean;
} {
	const data = useQuery(api.comments.listRecentForSearch, { limit: 200 });
	return {
		comments: (data ?? []) as Comment[],
		isLoading: data === undefined,
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
			parentId: string,
			content: string,
			parentCommentId: string | null,
			author: User,
		) => {
			const id = await createCommentMutation({
				parentType,
				parentId,
				parentCommentId: parentCommentId
					? (parentCommentId as Id<"comments">)
					: undefined,
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
				reactions: [],
			} as Comment;
		},

		editComment: async (commentId: string, content: string) => {
			await updateCommentMutation({
				commentId: commentId as Id<"comments">,
				content,
			});
		},

		deleteComment: async (commentId: string) => {
			await removeCommentMutation({ commentId: commentId as Id<"comments"> });
		},

		addReaction: async (commentId: string, emoji: string) => {
			await toggleReactionMutation({
				commentId: commentId as Id<"comments">,
				emoji,
			});
		},
	};
}

export function useActivityForTask(taskId: string | null): {
	activities: ActivityEntry[];
	isLoading: boolean;
} {
	const data = useQuery(
		api.activity.listForEntity,
		taskId ? { entityType: "task", entityId: taskId } : "skip",
	);
	return {
		activities: (data ?? []) as ActivityEntry[],
		isLoading: data === undefined,
	};
}

export function useRecentActivity(limit?: number): {
	activities: ActivityEntry[];
	isLoading: boolean;
} {
	const data = useQuery(api.activity.listRecent, { limit: limit ?? 50 });
	return {
		activities: (data ?? []) as ActivityEntry[],
		isLoading: data === undefined,
	};
}

export function useActivityMutations() {
	const logMutation = useMutation(api.activity.log);

	return {
		logActivity: async (entry: Omit<ActivityEntry, "id" | "timestamp">) => {
			await logMutation({
				entityType: entry.entityType,
				entityId: entry.entityId,
				type: entry.type,
				oldValue: entry.oldValue,
				newValue: entry.newValue,
				metadata: entry.metadata,
			});
		},
	};
}

export function useNotifications(): {
	notifications: Notification[];
	isLoading: boolean;
} {
	const data = useQuery(api.notifications.listForUser, {});
	return {
		notifications: (data ?? []) as Notification[],
		isLoading: data === undefined,
	};
}

export function useUnreadCount(): number | undefined {
	const data = useQuery(api.notifications.getUnreadCount, {});
	return data;
}

export function useNotificationMutations() {
	const markReadMutation = useMutation(api.notifications.markRead);
	const markArchivedMutation = useMutation(api.notifications.markArchived);
	const markAllReadMutation = useMutation(api.notifications.markAllRead);
	const dismissMutation = useMutation(api.notifications.dismiss);

	return {
		markNotificationRead: async (notificationId: string) => {
			await markReadMutation({
				notificationId: notificationId as Id<"notifications">,
			});
		},
		markNotificationArchived: async (notificationId: string) => {
			await markArchivedMutation({
				notificationId: notificationId as Id<"notifications">,
			});
		},
		markAllNotificationsRead: async () => {
			await markAllReadMutation({});
		},
		dismissNotification: async (notificationId: string) => {
			await dismissMutation({
				notificationId: notificationId as Id<"notifications">,
			});
		},
	};
}

export function useReminders(): {
	reminders: Reminder[];
	isLoading: boolean;
} {
	const data = useQuery(api.reminders.listForUser, {});
	return {
		reminders: (data ?? []) as Reminder[],
		isLoading: data === undefined,
	};
}

export function usePendingReminders(): {
	reminders: Reminder[];
	isLoading: boolean;
} {
	const data = useQuery(api.reminders.listPendingForUser, {});
	return {
		reminders: (data ?? []) as Reminder[],
		isLoading: data === undefined,
	};
}

export function usePendingRemindersForTask(taskId: string | null): {
	reminders: Reminder[];
	isLoading: boolean;
} {
	const data = useQuery(
		api.reminders.listPendingForTask,
		taskId ? { taskId } : "skip",
	);
	return {
		reminders: (data ?? []) as Reminder[],
		isLoading: data === undefined,
	};
}

const DEFAULT_REMINDER_PRIORITY = "normal";

export function buildOneTimeReminderPayload(
	taskId: string,
	remindAt: string,
	message?: string,
): Omit<Reminder, "id" | "createdAt" | "updatedAt" | "userId"> {
	return {
		entityId: taskId,
		entityType: "task",
		type: "one_time",
		remindAt,
		status: "pending",
		priority: DEFAULT_REMINDER_PRIORITY,
		metadata: {},
		...(message ? { message } : {}),
	};
}

export function useReminderMutations() {
	const createMutation = useMutation(api.reminders.create);
	const cancelMutation = useMutation(api.reminders.cancel);
	const dismissMutation = useMutation(api.reminders.dismiss);
	const snoozeMutation = useMutation(api.reminders.snooze);
	const rescheduleMutation = useMutation(api.reminders.reschedule);

	return {
		addReminder: async (
			payload: Omit<Reminder, "id" | "createdAt" | "updatedAt" | "userId">,
		): Promise<Id<"reminders">> => {
			return await createMutation({
				entityId: payload.entityId,
				type: payload.type,
				remindAt: payload.remindAt,
				recurringPattern: payload.recurringPattern,
				recurringConfig: payload.recurringConfig,
				endDate: payload.endDate,
				message: payload.message,
				priority: payload.priority,
				metadata: payload.metadata ?? {},
			});
		},
		cancelReminder: async (reminderId: string) => {
			await cancelMutation({ reminderId: reminderId as Id<"reminders"> });
		},
		dismissReminder: async (reminderId: string) => {
			await dismissMutation({ reminderId: reminderId as Id<"reminders"> });
		},
		snoozeReminder: async (reminderId: string, snoozeUntil: string) => {
			await snoozeMutation({
				reminderId: reminderId as Id<"reminders">,
				snoozeUntil,
			});
		},
		rescheduleReminder: async (reminderId: string, remindAt: string) => {
			await rescheduleMutation({
				reminderId: reminderId as Id<"reminders">,
				remindAt,
			});
		},
	};
}

export function useLabelMutations() {
	const createLabelMutation = useMutation(api.labels.create);
	const updateLabelMutation = useMutation(api.labels.update);
	const removeLabelMutation = useMutation(api.labels.remove);
	const adminUpdateLabelMutation = useMutation(api.admin.updateLabelAdmin);
	const archiveLabelMutation = useMutation(api.admin.archiveLabel);
	const unarchiveLabelMutation = useMutation(api.admin.unarchiveLabel);
	const deleteLabelIfUnusedMutation = useMutation(
		api.admin.deleteLabelIfUnused,
	);

	return {
		createLabel: async (name: string, color: string) => {
			const id = await createLabelMutation({ name, color });
			return { id, name, color } as TaskLabel;
		},
		updateLabel: async (
			id: string,
			updates: Partial<Pick<TaskLabel, "name" | "color">>,
		) => {
			await updateLabelMutation({ id: id as Id<"labels">, ...updates });
		},
		deleteLabel: async (id: string) => {
			// Backwards-compatible simple delete (no usage check)
			await removeLabelMutation({ id: id as Id<"labels"> });
		},
		updateLabelAdmin: async (
			id: Id<"labels">,
			updates: Partial<{ name: string; color: string; archived: boolean }>,
		) => {
			await adminUpdateLabelMutation({ id, ...updates });
		},
		archiveLabel: async (id: Id<"labels">) => {
			await archiveLabelMutation({ id });
		},
		unarchiveLabel: async (id: Id<"labels">) => {
			await unarchiveLabelMutation({ id });
		},
		deleteLabelIfUnused: async (id: Id<"labels">) => {
			await deleteLabelIfUnusedMutation({ id });
		},
	};
}
