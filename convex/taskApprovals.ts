import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

const APPROVAL_PREFIX_USER = "user:";
const APPROVAL_PREFIX_TEAM = "team:";

export function encodeApprovalId(type: "user" | "team", id: string): string {
	const prefix = type === "user" ? APPROVAL_PREFIX_USER : APPROVAL_PREFIX_TEAM;
	return `${prefix}${id}`;
}

export function decodeApprovalId(
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

export async function getPotentialReviewerUserIds(
	ctx: MutationCtx,
	requiredApprovalIds: string[] | undefined,
): Promise<Set<Id<"users">>> {
	const userIds = new Set<Id<"users">>();
	if (!requiredApprovalIds?.length) return userIds;

	const teamIds = new Set<Id<"teams">>();
	for (const encoded of requiredApprovalIds) {
		const decoded = decodeApprovalId(encoded);
		if (decoded?.type === "user") {
			userIds.add(decoded.id as Id<"users">);
		} else if (decoded?.type === "team") {
			teamIds.add(decoded.id as Id<"teams">);
		}
	}
	const teamDocs = await Promise.all(
		[...teamIds].map((id) => ctx.db.get("teams", id)),
	);
	for (const team of teamDocs) {
		if (team) {
			for (const memberId of team.memberIds) {
				userIds.add(memberId);
			}
		}
	}
	return userIds;
}

export async function scheduleAwaitingReviewNotifications(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	requiredApprovalIds: string[] | undefined,
	actorId: Id<"users">,
): Promise<Promise<unknown>[]> {
	if (!requiredApprovalIds?.length) return [];
	const reviewerIds = await getPotentialReviewerUserIds(
		ctx,
		requiredApprovalIds,
	);
	reviewerIds.delete(actorId);
	const promises: Promise<unknown>[] = [];
	for (const recipientId of reviewerIds) {
		promises.push(
			ctx.scheduler.runAfter(
				0,
				internal.notifications._notifyTaskAwaitingReview,
				{ taskId, recipientId, actorId },
			),
		);
	}
	return promises;
}

export async function computeApprovalCompleteness(
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

export function resolveApprovalData(
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

	const approvedBy = approvedByIds
		.map((userId) => usersMap.get(userId))
		.filter(
			(u): u is { id: string; name: string; avatarUrl: string } =>
				u !== undefined,
		);

	return { requiredApprovalBy, approvedBy };
}
