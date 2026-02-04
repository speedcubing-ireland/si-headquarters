import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { requireUserId, isVolunteer } from "./auth";
import { internal } from "./_generated/api";

const APPROVAL_PREFIX_USER = "user:";
const APPROVAL_PREFIX_TEAM = "team:";

function formatCompetitionName(name: string): string {
	const words = name.trim().split(/\s+/);
	const initials = words
		.map((word) => {
			if (/^\d{4}$/.test(word)) return "";
			const match = word.match(/[A-Z]/);
			return match ? match[0] : word[0]?.toUpperCase() || "";
		})
		.filter(Boolean)
		.join("");

	const yearMatches = name.match(/\b(\d{4})\b/g);
	const year = yearMatches ? yearMatches[yearMatches.length - 1].slice(-2) : "";

	return year ? `${initials}${year}` : initials;
}

const ERROR_TASK_NO_COMPETITION = "Only volunteers can modify tasks without a competition";
const ERROR_TASK_NO_ACCESS = "You can only modify tasks linked to competitions you are organizing";
const ERROR_TASK_MOVE = "You can only move tasks to competitions you are organizing";

async function hasCompetitionAccess(
	ctx: QueryCtx | MutationCtx,
	isVolunteer: boolean,
	userId: Id<"users">,
	competitionId: Id<"competitions"> | string | null | undefined,
): Promise<boolean> {
	if (isVolunteer) return true;
	if (!competitionId) return false;

	const competition = await ctx.db.get(
		"competitions",
		competitionId as Id<"competitions">,
	);
	if (!competition) return false;

	return (
		competition.organiserIds.includes(userId) ||
		competition.compLeadId === userId ||
		competition.leadDelegateId === userId
	);
}

async function requireTaskAccess(
	ctx: MutationCtx,
	volunteer: boolean,
	userId: Id<"users">,
	task: Doc<"tasks">,
): Promise<void> {
	if (volunteer) return;

	if (!task.parentCompetitionId) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: ERROR_TASK_NO_COMPETITION,
		});
	}

	const hasAccess = await hasCompetitionAccess(
		ctx,
		volunteer,
		userId,
		task.parentCompetitionId,
	);
	if (!hasAccess) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: ERROR_TASK_NO_ACCESS,
		});
	}
}

function encodeApprovalId(type: "user" | "team", id: string): string {
	const prefix = type === "user" ? APPROVAL_PREFIX_USER : APPROVAL_PREFIX_TEAM;
	return `${prefix}${id}`;
}

function decodeApprovalId(
	encoded: string,
): { type: "user" | "team"; id: string } | null {
	if (encoded.startsWith(APPROVAL_PREFIX_USER)) {
		return { type: "user", id: encoded.slice(APPROVAL_PREFIX_USER.length) };
	}
	if (encoded.startsWith(APPROVAL_PREFIX_TEAM)) {
		return { type: "team", id: encoded.slice(APPROVAL_PREFIX_TEAM.length) };
	}
	return null;
}

async function computeApprovalCompleteness(
	ctx: {
		db: {
			get: (
				table: "teams",
				id: Id<"teams">,
			) => Promise<{
				memberIds: Id<"users">[];
			} | null>;
		};
	},
	requiredApprovalIds: string[],
	approvedByIds: string[],
): Promise<{ isFullyApproved: boolean; pendingKeys: string[] }> {
	if (requiredApprovalIds.length === 0) {
		return { isFullyApproved: true, pendingKeys: [] };
	}

	const approvingUserIds = new Set(approvedByIds);
	const pendingKeys: string[] = [];

	// Load all teams referenced in requiredApprovalIds
	const teamIds = new Set<Id<"teams">>();
	for (const encoded of requiredApprovalIds) {
		const decoded = decodeApprovalId(encoded);
		if (decoded?.type === "team") {
			teamIds.add(decoded.id as Id<"teams">);
		}
	}

	const teamDocs = await Promise.all(
		[...teamIds].map((id) => ctx.db.get("teams", id)),
	);
	const teamMembersMap = new Map<string, Set<string>>();
	teamDocs.forEach((team, i) => {
		if (team) {
			const teamId = [...teamIds][i];
			teamMembersMap.set(teamId, new Set(team.memberIds.map((id) => id)));
		}
	});

	// Check each required approval
	for (const encoded of requiredApprovalIds) {
		const decoded = decodeApprovalId(encoded);
		if (!decoded) {
			pendingKeys.push(encoded);
			continue;
		}

		if (decoded.type === "user") {
			if (!approvingUserIds.has(decoded.id)) {
				pendingKeys.push(encoded);
			}
		} else {
			// Team approval: check if any team member has approved
			const teamMembers = teamMembersMap.get(decoded.id);
			if (!teamMembers) {
				pendingKeys.push(encoded);
				continue;
			}
			const hasApprovingMember = [...approvingUserIds].some((userId) =>
				teamMembers.has(userId),
			);
			if (!hasApprovingMember) {
				pendingKeys.push(encoded);
			}
		}
	}

	return {
		isFullyApproved: pendingKeys.length === 0,
		pendingKeys,
	};
}

function resolveApprovalData(
	_ctx: {
		db: {
			get: (
				table: "users" | "teams",
				id: Id<"users"> | Id<"teams">,
			) => Promise<
				| {
						_id: Id<"users">;
						name: string | null;
						image: string | null;
				  }
				| {
						_id: Id<"teams">;
						name: string;
						memberIds: Id<"users">[];
				  }
				| null
			>;
		};
	},
	requiredApprovalIds: string[],
	approvedByIds: string[],
	usersMap: Map<string, { id: string; name: string; avatarUrl: string }>,
	teamsMap: Map<
		string,
		{
			id: string;
			name: string;
			members: { id: string; name: string; avatarUrl: string }[];
		}
	>,
): {
	requiredApprovalBy: Array<
		| { id: string; name: string; avatarUrl: string }
		| {
				id: string;
				name: string;
				members: Array<{ id: string; name: string; avatarUrl: string }>;
		  }
	>;
	approvedBy: Array<{ id: string; name: string; avatarUrl: string }>;
} {
	const requiredApprovalBy: Array<
		| { id: string; name: string; avatarUrl: string }
		| {
				id: string;
				name: string;
				members: Array<{ id: string; name: string; avatarUrl: string }>;
		  }
	> = [];

	// Resolve required approvers
	for (const encoded of requiredApprovalIds) {
		const decoded = decodeApprovalId(encoded);
		if (!decoded) continue;

		if (decoded.type === "user") {
			const user = usersMap.get(decoded.id);
			if (user) {
				requiredApprovalBy.push(user);
			}
		} else {
			const team = teamsMap.get(decoded.id);
			if (team) {
				requiredApprovalBy.push(team);
			}
		}
	}

	// Resolve approved by users
	const approvedBy = approvedByIds
		.map((userId) => usersMap.get(userId))
		.filter(
			(u): u is { id: string; name: string; avatarUrl: string } =>
				u !== undefined,
		);

	return { requiredApprovalBy, approvedBy };
}

const taskStatus = v.union(
	v.literal("backlog"),
	v.literal("to-do"),
	v.literal("in-progress"),
	v.literal("awaiting-review"),
	v.literal("done"),
	v.literal("cancelled"),
);

const taskPriority = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high"),
	v.literal("urgent"),
);

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
	ownerId: v.optional(v.string()),
	ownerType: v.optional(v.union(v.literal("user"), v.literal("team"))),
	assigneeId: v.optional(v.id("users")),
	phaseId: v.optional(v.id("phases")),
	labelIds: v.array(v.id("labels")),
	requiredApprovalIds: v.optional(v.array(v.string())),
	approvedByIds: v.optional(v.array(v.string())),
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
			// Volunteers see all tasks
			return await ctx.db
				.query("tasks")
				.withIndex("by_archived", (q) => q.eq("archived", archived))
				.order("desc")
				.collect();
		}

		// Guest organizers only see tasks from competitions they're organizing
		// First, get all competitions where user is organizer
		const allCompetitions = await ctx.db.query("competitions").collect();
		const accessibleCompetitionIds: Id<"competitions">[] = [];
		const userIdTyped = userId as Id<"users">;
		for (const comp of allCompetitions) {
			if (
				comp.organiserIds.includes(userIdTyped) ||
				comp.compLeadId === userIdTyped ||
				comp.leadDelegateId === userIdTyped
			) {
				accessibleCompetitionIds.push(comp._id);
			}
		}

		// Query tasks for each accessible competition using the index
		// This avoids loading all tasks and filtering in memory
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
		// Flatten and deduplicate (in case a task appears in multiple queries, though it shouldn't)
		const taskMap = new Map<string, Doc<"tasks">>();
		for (const taskArray of taskArrays) {
			for (const task of taskArray) {
				taskMap.set(task._id, task);
			}
		}

		// Return tasks sorted by creation time (descending)
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

		// Guest organizers can only see tasks from competitions they're organizing
		if (!task.parentCompetitionId) {
			return null; // Tasks without competition parent are only accessible to volunteers
		}

		const hasAccess = await hasCompetitionAccess(
			ctx,
			volunteer,
			userId as Id<"users">,
			task.parentCompetitionId,
		);
		return hasAccess ? task : null;
	},
});

const userShape = v.object({
	id: v.string(),
	name: v.string(),
	avatarUrl: v.string(),
});

const taskLabelShape = v.object({
	id: v.string(),
	name: v.string(),
	color: v.string(),
});

const phaseShape = v.object({
	id: v.string(),
	name: v.string(),
	description: v.string(),
});

const parentShape = v.union(
	v.null(),
	v.object({
		type: v.union(v.literal("task"), v.literal("competition")),
		linkedId: v.string(),
	}),
);

const subtaskMinimalShape = v.object({
	id: v.string(),
	title: v.string(),
	status: taskStatus,
});

const taskForUIReturns = v.object({
	id: v.string(),
	identifier: v.string(),
	parent: parentShape,
	parentDisplayName: v.union(v.string(), v.null()),
	title: v.string(),
	description: v.string(),
	owner: v.union(
		v.null(),
		userShape,
		v.object({ id: v.string(), name: v.string(), members: v.array(userShape) }),
	),
	assignee: v.union(v.null(), userShape),
	phase: v.union(v.null(), phaseShape),
	status: taskStatus,
	priority: taskPriority,
	dueDate: v.union(v.string(), v.null()),
	requiredApprovalBy: v.array(v.any()),
	approvedBy: v.array(v.any()),
	labels: v.array(taskLabelShape),
	resources: v.array(v.any()),
	subTasks: v.array(subtaskMinimalShape),
	createdAt: v.string(),
	updatedAt: v.string(),
	archivedAt: v.union(v.string(), v.null()),
});

export const listForUI = query({
	args: {
		archived: v.optional(v.boolean()),
		competitionId: v.optional(v.string()),
	},
	returns: v.array(taskForUIReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		const archived = args.archived ?? false;
		const competitionId = args.competitionId;

		let tasks: Doc<"tasks">[];
		if (competitionId) {
			// If filtering by competition, check access first
			if (!volunteer) {
				const hasAccess = await hasCompetitionAccess(
					ctx,
					volunteer,
					userId as Id<"users">,
					competitionId,
				);
				if (!hasAccess) {
					return []; // Return empty array if no access
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
			// No competition filter - get all tasks and filter by access
			if (volunteer) {
				tasks = await ctx.db
					.query("tasks")
					.withIndex("by_archived", (q) => q.eq("archived", archived))
					.order("desc")
					.collect();
			} else {
				// Guest organizers only see tasks from competitions they're organizing
				const allTasks = await ctx.db
					.query("tasks")
					.withIndex("by_archived", (q) => q.eq("archived", archived))
					.order("desc")
					.collect();

				// Get all competitions where user is organizer
				const allCompetitions = await ctx.db.query("competitions").collect();
				const accessibleCompetitionIds = new Set<string>();
				const userIdTyped = userId as Id<"users">;
				for (const comp of allCompetitions) {
					if (
						comp.organiserIds.includes(userIdTyped) ||
						comp.compLeadId === userIdTyped ||
						comp.leadDelegateId === userIdTyped
					) {
						accessibleCompetitionIds.add(comp._id);
					}
				}

				// Filter tasks to only those linked to accessible competitions
				tasks = allTasks.filter(
					(task) =>
						!task.parentCompetitionId ||
						accessibleCompetitionIds.has(task.parentCompetitionId),
				);
			}
		}

		const labelIds = new Set<Id<"labels">>();
		const userIds = new Set<Id<"users">>();
		const teamIds = new Set<string>();
		const phaseIds = new Set<Id<"phases">>();
		const approvalTeamIds = new Set<Id<"teams">>();
		for (const t of tasks) {
			for (const lid of t.labelIds) labelIds.add(lid);
			if (t.assigneeId) userIds.add(t.assigneeId);
			if (t.ownerId) {
				if (t.ownerType === "team") teamIds.add(t.ownerId);
				else userIds.add(t.ownerId as Id<"users">);
			}
			if (t.phaseId) phaseIds.add(t.phaseId);
			// Collect approval-related IDs
			if (t.requiredApprovalIds) {
				for (const encoded of t.requiredApprovalIds) {
					const decoded = decodeApprovalId(encoded);
					if (decoded?.type === "user") {
						userIds.add(decoded.id as Id<"users">);
					} else if (decoded?.type === "team") {
						approvalTeamIds.add(decoded.id as Id<"teams">);
					}
				}
			}
			if (t.approvedByIds) {
				for (const userId of t.approvedByIds) {
					userIds.add(userId as Id<"users">);
				}
			}
		}

		const labelArr = [...labelIds];
		const userArr = [...userIds];
		const teamArr = [...teamIds] as Id<"teams">[];
		const approvalTeamArr = [...approvalTeamIds];
		const phaseArr = [...phaseIds] as Id<"phases">[];

		const [labelDocs, userDocs, teamDocs, approvalTeamDocs, phaseDocs] =
			await Promise.all([
				Promise.all(labelArr.map((id) => ctx.db.get("labels", id))),
				Promise.all(userArr.map((id) => ctx.db.get("users", id))),
				Promise.all(teamArr.map((id) => ctx.db.get("teams", id))),
				Promise.all(approvalTeamArr.map((id) => ctx.db.get("teams", id))),
				Promise.all(phaseArr.map((id) => ctx.db.get("phases", id))),
			]);

		const labelsMap = new Map<
			string,
			{ id: string; name: string; color: string }
		>();
		labelArr.forEach((id, i) => {
			const l = labelDocs[i];
			if (l) labelsMap.set(id, { id, name: l.name, color: l.color });
		});

		const usersMap = new Map<
			string,
			{ id: string; name: string; avatarUrl: string }
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
			string,
			{ id: string; name: string; avatarUrl: string }
		>();
		[...memberIds].forEach((id, i) => {
			const u = memberDocs[i];
			if (u)
				memberMap.set(id, { id, name: u.name ?? "", avatarUrl: u.image ?? "" });
		});

		const teamsMap = new Map<
			string,
			{
				id: string;
				name: string;
				members: { id: string; name: string; avatarUrl: string }[];
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
						.filter((u): u is { id: string; name: string; avatarUrl: string } =>
							Boolean(u),
						),
				});
		});

		// Build approval teams map
		const approvalTeamsMap = new Map<
			string,
			{
				id: string;
				name: string;
				members: { id: string; name: string; avatarUrl: string }[];
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
						.filter((u): u is { id: string; name: string; avatarUrl: string } =>
							Boolean(u),
						),
				});
		});

		const phasesMap = new Map<
			string,
			{ id: string; name: string; description: string }
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

		const taskIdToTitle = new Map<string, string>();
		for (const t of tasks) {
			taskIdToTitle.set(t._id, t.title);
		}

		const parentCompetitionIds = [
			...new Set(
				tasks
					.map((t) => t.parentCompetitionId)
					.filter((id): id is string => id != null),
			),
		];
		const competitionDocs = await Promise.all(
			parentCompetitionIds.map((id) => ctx.db.get("competitions", id as Id<"competitions">)),
		);
		const competitionIdToName = new Map<string, string>();
		parentCompetitionIds.forEach((id, i) => {
			const doc = competitionDocs[i];
			if (doc) competitionIdToName.set(id, formatCompetitionName(doc.name));
		});

		const parentTaskIds = new Set(tasks.map((t) => t._id));
		const subtaskRowsByParent = new Map<
			string,
			Array<{
				id: string;
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
						? teamsMap.get(t.ownerId)
						: usersMap.get(t.ownerId)
					: null;
				const assignee = t.assigneeId
					? (usersMap.get(t.assigneeId) ?? null)
					: null;
				const phase = t.phaseId ? (phasesMap.get(t.phaseId) ?? null) : null;
				const labels = t.labelIds
					.map((lid: Id<"labels">) => labelsMap.get(lid))
					.filter(Boolean) as { id: string; name: string; color: string }[];
				const parent: {
					type: "task" | "competition";
					linkedId: string;
				} | null = t.parentTaskId
					? { type: "task", linkedId: t.parentTaskId }
					: t.parentCompetitionId
						? { type: "competition", linkedId: t.parentCompetitionId }
						: null;

				const parentDisplayName: string | null = parent
					? parent.type === "task"
						? taskIdToTitle.get(parent.linkedId) ?? null
						: competitionIdToName.get(parent.linkedId) ?? null
					: null;

				const subTasks = subtaskRowsByParent.get(t._id) ?? [];

				// Resolve approval data - combine teams maps
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
			// Guest organizers can only see tasks from competitions they're organizing
			if (!t.parentCompetitionId) {
				return null; // Tasks without competition parent are only accessible to volunteers
			}

			const hasAccess = await hasCompetitionAccess(
				ctx,
				volunteer,
				userId as Id<"users">,
				t.parentCompetitionId,
			);
			if (!hasAccess) {
				return null;
			}
		}

		// Collect approval-related IDs
		const approvalUserIds = new Set<Id<"users">>();
		const approvalTeamIds = new Set<Id<"teams">>();
		if (t.requiredApprovalIds) {
			for (const encoded of t.requiredApprovalIds) {
				const decoded = decodeApprovalId(encoded);
				if (decoded?.type === "user") {
					approvalUserIds.add(decoded.id as Id<"users">);
				} else if (decoded?.type === "team") {
					approvalTeamIds.add(decoded.id as Id<"teams">);
				}
			}
		}
		if (t.approvedByIds) {
			for (const userId of t.approvedByIds) {
				approvalUserIds.add(userId as Id<"users">);
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
			t.phaseId ? ctx.db.get("phases", t.phaseId as Id<"phases">) : null,
			Promise.all([...approvalUserIds].map((id) => ctx.db.get("users", id))),
			Promise.all([...approvalTeamIds].map((id) => ctx.db.get("teams", id))),
		]);

		const labelsMap = new Map<
			string,
			{ id: string; name: string; color: string }
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
					id: string;
					name: string;
					members: { id: string; name: string; avatarUrl: string }[];
			  }
			| { id: string; name: string; avatarUrl: string }
			| null = null;
		if (ownerDoc) {
			if ("memberIds" in ownerDoc) {
				const memberDocs = await Promise.all(
					ownerDoc.memberIds.map((mid) => ctx.db.get("users", mid)),
				);
				const members: { id: string; name: string; avatarUrl: string }[] = [];
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
					id: phaseDoc._id as Id<"phases">,
					name: phaseDoc.name,
					description: phaseDoc.description,
				}
			: null;

		const labels = t.labelIds
			.map((lid) => labelsMap.get(lid))
			.filter(Boolean) as { id: string; name: string; color: string }[];
		const parent: { type: "task" | "competition"; linkedId: string } | null =
			t.parentTaskId
				? { type: "task", linkedId: t.parentTaskId }
				: t.parentCompetitionId
					? { type: "competition", linkedId: t.parentCompetitionId }
					: null;

		let parentDisplayName: string | null = null;
		if (parent) {
			if (parent.type === "task") {
				const parentTask = await ctx.db.get("tasks", parent.linkedId as Id<"tasks">);
				parentDisplayName = parentTask?.title ?? null;
			} else {
				const comp = await ctx.db.get(
					"competitions",
					parent.linkedId as Id<"competitions">,
				);
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

		// Build approval users map
		const approvalUsersMap = new Map<
			string,
			{ id: string; name: string; avatarUrl: string }
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

		// Build approval teams map with members
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
			string,
			{ id: string; name: string; avatarUrl: string }
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
			string,
			{
				id: string;
				name: string;
				members: { id: string; name: string; avatarUrl: string }[];
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
							(u): u is { id: string; name: string; avatarUrl: string } =>
								u !== undefined,
						),
				});
		});

		// Resolve approval data - combine users maps
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
	parentCompetitionId: v.optional(v.string()),
	ownerId: v.optional(v.string()),
	ownerType: v.optional(v.union(v.literal("user"), v.literal("team"))),
	assigneeId: v.optional(v.id("users")),
	phaseId: v.optional(v.id("phases")),
	labelIds: v.optional(v.array(v.id("labels"))),
	requiredApprovalIds: v.optional(v.array(v.string())),
};

export const create = mutation({
	args: taskCreateArgs,
	returns: v.id("tasks"),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
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

		const counterDocs = await ctx.db.query("taskCounter").take(1);
		let nextNum: number;
		if (counterDocs.length === 0) {
			await ctx.db.insert("taskCounter", { next: 1 });
			nextNum = 1;
		} else {
			const doc = counterDocs[0];
			nextNum = doc.next;
			await ctx.db.patch("taskCounter", doc._id, { next: doc.next + 1 });
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

		return taskId;
	},
});

const linkedResourceValidator = v.union(
	v.object({ type: v.literal("google-sheet"), sheetId: v.string() }),
	v.object({ type: v.literal("canva-design"), designId: v.string() }),
);

const taskUpdateArgs = {
	title: v.optional(v.string()),
	description: v.optional(v.string()),
	status: v.optional(taskStatus),
	priority: v.optional(taskPriority),
	dueDate: v.optional(v.union(v.string(), v.null())),
	parentTaskId: v.optional(v.union(v.id("tasks"), v.null())),
	parentCompetitionId: v.optional(v.union(v.string(), v.null())),
	ownerId: v.optional(v.union(v.string(), v.null())),
	ownerType: v.optional(v.union(v.literal("user"), v.literal("team"))),
	assigneeId: v.optional(v.union(v.id("users"), v.null())),
	phaseId: v.optional(v.union(v.id("phases"), v.null())),
	labelIds: v.optional(v.array(v.id("labels"))),
	resources: v.optional(v.array(linkedResourceValidator)),
};

export const update = mutation({
	args: {
		taskId: v.id("tasks"),
		updates: v.object(taskUpdateArgs),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
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
		const patch: Record<string, unknown> = { ...args.updates, updatedAt: now };
		if (args.updates.dueDate === null) patch.dueDate = undefined;
		if (args.updates.parentTaskId === null) patch.parentTaskId = undefined;
		if (args.updates.parentCompetitionId === null)
			patch.parentCompetitionId = undefined;
		if (args.updates.ownerId === null) patch.ownerId = undefined;
		if (args.updates.assigneeId === null) patch.assigneeId = undefined;
		if (args.updates.phaseId === null) patch.phaseId = undefined;

		const oldAssigneeId = doc.assigneeId;
		const newAssigneeId =
			args.updates.assigneeId === null ? undefined : args.updates.assigneeId;
		const oldStatus = doc.status;
		const newStatus = args.updates.status ?? doc.status;

		// Handle status transition to awaiting-review: auto-promote to done if already fully approved
		if (args.updates.status === "awaiting-review") {
			const { isFullyApproved } = await computeApprovalCompleteness(
				ctx,
				doc.requiredApprovalIds ?? [],
				doc.approvedByIds ?? [],
			);
			if (
				isFullyApproved &&
				doc.requiredApprovalIds &&
				doc.requiredApprovalIds.length > 0
			) {
				patch.status = "done";
			}
		}

		await ctx.db.patch("tasks", args.taskId, patch as Record<string, unknown>);

		if (!userId) return null;

		const notificationPromises: Promise<unknown>[] = [];

		if (oldAssigneeId !== newAssigneeId) {
			if (oldAssigneeId && oldAssigneeId !== userId) {
				notificationPromises.push(
					ctx.scheduler.runAfter(
						0,
						internal.notifications._notifyTaskUnassigned,
						{
							taskId: args.taskId,
							assigneeId: oldAssigneeId,
							actorId: userId,
						},
					),
				);
			}
			if (newAssigneeId && newAssigneeId !== userId) {
				notificationPromises.push(
					ctx.scheduler.runAfter(
						0,
						internal.notifications._notifyTaskAssigned,
						{
							taskId: args.taskId,
							assigneeId: newAssigneeId,
							actorId: userId,
						},
					),
				);
			}
		}

		if (oldStatus !== newStatus && args.updates.status !== undefined) {
			const recipients = new Set<Id<"users">>();
			if (doc.assigneeId && doc.assigneeId !== userId) {
				recipients.add(doc.assigneeId);
			}
			if (doc.ownerId && doc.ownerType === "user" && doc.ownerId !== userId) {
				recipients.add(doc.ownerId as Id<"users">);
			}

			for (const recipientId of recipients) {
				notificationPromises.push(
					ctx.scheduler.runAfter(
						0,
						internal.notifications._notifyTaskStatusChanged,
						{
							taskId: args.taskId,
							recipientId,
							actorId: userId,
							oldStatus,
							newStatus,
						},
					),
				);
			}
		}

		await Promise.allSettled(notificationPromises);
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
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const volunteer = await isVolunteer(ctx);
		if (args.taskIds.length === 0) {
			return null;
		}

		for (const taskId of args.taskIds) {
			const doc = await ctx.db.get("tasks", taskId);
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
			const doc = await ctx.db.get("tasks", taskId);
			if (!doc) continue;
			const patch: Record<string, unknown> = {
				...args.updates,
				updatedAt: now,
			};
			if (args.updates.dueDate === null) patch.dueDate = undefined;
			if (args.updates.parentTaskId === null) patch.parentTaskId = undefined;
			if (args.updates.parentCompetitionId === null)
				patch.parentCompetitionId = undefined;
			if (args.updates.ownerId === null) patch.ownerId = undefined;
			if (args.updates.assigneeId === null) patch.assigneeId = undefined;
			if (args.updates.phaseId === null) patch.phaseId = undefined;

			if (args.updates.status === "awaiting-review") {
				const { isFullyApproved } = await computeApprovalCompleteness(
					ctx,
					doc.requiredApprovalIds ?? [],
					doc.approvedByIds ?? [],
				);
				if (
					isFullyApproved &&
					doc.requiredApprovalIds &&
					doc.requiredApprovalIds.length > 0
				) {
					patch.status = "done";
				}
			}

			await ctx.db.patch("tasks", taskId, patch as Record<string, unknown>);
		}
		return null;
	},
});

export const archive = mutation({
	args: { taskIds: v.array(v.id("tasks")) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
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
		}
		return null;
	},
});

export const unarchive = mutation({
	args: { taskIds: v.array(v.id("tasks")) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
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
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const volunteer = await isVolunteer(ctx);
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task) {
			throw new ConvexError("Task not found");
		}

		await requireTaskAccess(ctx, volunteer, userId, task);

		const encodedId = encodeApprovalId(args.approverType, args.approverId);
		const currentIds = task.requiredApprovalIds ?? [];
		if (currentIds.includes(encodedId)) {
			return null;
		}

		await ctx.db.patch("tasks", args.taskId, {
			requiredApprovalIds: [...currentIds, encodedId],
			updatedAt: Date.now(),
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
		const userId = (await requireUserId(ctx)) as Id<"users">;
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
		return null;
	},
});

export const approveTask = mutation({
	args: {
		taskId: v.id("tasks"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const volunteer = await isVolunteer(ctx);
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task) {
			throw new ConvexError("Task not found");
		}

		await requireTaskAccess(ctx, volunteer, userId, task);

		const currentApprovedIds = task.approvedByIds ?? [];
		const userIdStr = userId as string;
		if (currentApprovedIds.includes(userIdStr)) {
			return null;
		}

		const newApprovedIds: string[] = [...currentApprovedIds, userIdStr];
		const now = Date.now();

		const { isFullyApproved } = await computeApprovalCompleteness(
			ctx,
			task.requiredApprovalIds ?? [],
			newApprovedIds,
		);

		const patch: Record<string, unknown> = {
			approvedByIds: newApprovedIds,
			updatedAt: now,
		};

		if (isFullyApproved && task.status === "awaiting-review") {
			patch.status = "done";
		}

		await ctx.db.patch("tasks", args.taskId, patch as Record<string, unknown>);
		return null;
	},
});

export const unapproveTask = mutation({
	args: {
		taskId: v.id("tasks"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const volunteer = await isVolunteer(ctx);
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task) {
			throw new ConvexError("Task not found");
		}

		await requireTaskAccess(ctx, volunteer, userId, task);

		const currentApprovedIds = task.approvedByIds ?? [];
		const userIdStr = userId as string;
		const filteredIds = currentApprovedIds.filter((id) => id !== userIdStr);

		await ctx.db.patch("tasks", args.taskId, {
			approvedByIds: filteredIds,
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const remove = mutation({
	args: { taskIds: v.array(v.id("tasks")) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const volunteer = await isVolunteer(ctx);

		if (!volunteer) {
			for (const taskId of args.taskIds) {
				const task = await ctx.db.get("tasks", taskId);
				if (!task) continue;
				await requireTaskAccess(ctx, volunteer, userId, task);
			}
		}

		for (const id of args.taskIds) {
			await ctx.db.delete("tasks", id);
		}
		return null;
	},
});
