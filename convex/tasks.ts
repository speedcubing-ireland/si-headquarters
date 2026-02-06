import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { requireUserId, isVolunteer } from "./auth";
import { internal } from "./_generated/api";
import {
	collectAllTaskIdsRecursively,
	deleteTasksAndRelatedData,
} from "./lib/taskDeletion";
import {
	ERROR_TASK_MOVE,
	ERROR_TASK_NO_ACCESS,
	ERROR_TASK_NO_COMPETITION,
	hasTaskCompetitionAccess,
	listOrganisedCompetitionIds,
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
	sendTaskPriorityChangeNotifications,
	sendTaskRelationBlockedNotifications,
	sendTaskRelationUnblockedNotifications,
	sendTaskStatusChangeNotifications,
} from "./taskNotifications";
import {
	buildTaskPatch,
	applyAwaitingReviewAutoPromote,
	taskUpdateArgs,
} from "./taskPatch";
import type { TaskUpdate } from "./taskPatch";
import {
	taskStatus,
	taskPriority,
	approvalShape,
	linkedResource,
	userShape as sharedUserShape,
	teamShape,
	labelShape as taskLabelShape,
	phaseShape,
} from "./lib/validators";
import { MAX_BULK_UPDATE_COUNT } from "./lib/constants";
import { toISO } from "./lib/transforms";
import {
	buildTaskRelationDataMap,
	countUnresolvedBlockers,
	wouldCreateTaskRelationCycle,
	handleBlockingStatusTransitionNotifications,
	isTaskBlockingStatus,
	EMPTY_TASK_RELATION_DATA,
} from "./lib/taskRelations";

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

		if (volunteer) {
			return await ctx.db
				.query("tasks")
				.withIndex("by_archived", (q) => q.eq("archived", archived))
				.order("desc")
				.collect();
		}

		const accessibleCompetitionIds = await listOrganisedCompetitionIds(
			ctx,
			userId,
		);

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
					return [];
				}
				accessibleCompetitionIds.add(competitionId);
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
				const taskMap = new Map<Id<"tasks">, Doc<"tasks">>();
				for (const taskGroup of taskGroups) {
					for (const task of taskGroup) {
						taskMap.set(task._id, task);
					}
				}
				tasks = [...taskMap.values()].sort(
					(a, b) => b._creationTime - a._creationTime,
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
				const matching = children.filter((child) => {
					if (child.archived !== archived) {
						return false;
					}
					if (volunteer) {
						return true;
					}
					return (
						child.parentCompetitionId !== undefined &&
						accessibleCompetitionIds.has(child.parentCompetitionId)
					);
				});
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
			const hasAccess = await hasTaskCompetitionAccess(
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
				if (parentTask) {
					const sameCompetition =
						parentTask.parentCompetitionId !== undefined &&
						parentTask.parentCompetitionId === t.parentCompetitionId;
					parentDisplayName =
						volunteer || sameCompetition ? parentTask.title : null;
				}
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
			.filter((child) => {
				if (child.archived !== t.archived) {
					return false;
				}
				if (volunteer) {
					return true;
				}
				return child.parentCompetitionId === t.parentCompetitionId;
			})
			.map((c) => ({
				id: c._id,
				title: c.title,
				status: c.status,
			}));

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

type TaskPatchForUpdate = ReturnType<typeof buildTaskPatch>;

async function ensureCompetitionWriteAccess(
	ctx: MutationCtx,
	volunteer: boolean,
	userId: Id<"users">,
	competitionId: Id<"competitions">,
	errorMessage: string,
): Promise<void> {
	if (volunteer) {
		return;
	}
	const hasAccess = await hasTaskCompetitionAccess(
		ctx,
		volunteer,
		userId,
		competitionId,
	);
	if (hasAccess) {
		return;
	}
	throw new ConvexError({
		code: "FORBIDDEN",
		message: errorMessage,
	});
}

async function ensureTaskMoveAccess(
	ctx: MutationCtx,
	volunteer: boolean,
	userId: Id<"users">,
	parentCompetitionId: Id<"competitions"> | null | undefined,
): Promise<void> {
	if (parentCompetitionId === undefined || parentCompetitionId === null) {
		return;
	}
	await ensureCompetitionWriteAccess(
		ctx,
		volunteer,
		userId,
		parentCompetitionId,
		ERROR_TASK_MOVE,
	);
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

	await diffAndLog(
		ctx,
		userId,
		"task",
		taskId,
		doc,
		patch,
		TASK_ACTIVITY_CONFIG,
	);

	if (updates.labelIds) {
		await diffLabels(
			ctx,
			userId,
			"task",
			taskId,
			doc.labelIds,
			updates.labelIds,
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

	if (updates.status !== undefined && oldStatus !== newStatus) {
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

	if (updates.priority !== undefined && oldPriority !== newPriority) {
		sendTaskPriorityChangeNotifications(
			ctx,
			taskId,
			doc,
			oldPriority,
			newPriority,
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

function assertValidApprovalIds(requiredApprovalIds: string[]): void {
	for (const id of requiredApprovalIds) {
		if (decodeApprovalId(id) !== null) {
			continue;
		}
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: `Invalid approval ID format: ${id}`,
		});
	}
}

async function nextTaskIdentifier(ctx: MutationCtx): Promise<string> {
	const counter = await ctx.db.query("taskCounter").first();
	if (!counter) {
		await ctx.db.insert("taskCounter", { next: 2 });
		return "HQ-1";
	}

	const nextNum = counter.next;
	await ctx.db.patch("taskCounter", counter._id, { next: nextNum + 1 });
	return `HQ-${nextNum}`;
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

		if (args.parentCompetitionId) {
			await ensureCompetitionWriteAccess(
				ctx,
				volunteer,
				userId,
				args.parentCompetitionId,
				ERROR_TASK_NO_ACCESS,
			);
		} else if (!volunteer) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: ERROR_TASK_NO_COMPETITION,
			});
		}

		const now = Date.now();
		const identifier = await nextTaskIdentifier(ctx);

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
			ownerId: args.ownerId,
			ownerType: args.ownerType,
			assigneeId: args.assigneeId,
			phaseId: args.phaseId,
			labelIds: args.labelIds ?? [],
			requiredApprovalIds: approvalIds,
			updatedAt: now,
		});

		if (args.assigneeId && args.assigneeId !== userId) {
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
