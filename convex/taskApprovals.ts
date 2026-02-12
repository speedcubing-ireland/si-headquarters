import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { emitNotificationEvent } from "./notifications";

const APPROVAL_PREFIX_USER = "user:";
const APPROVAL_PREFIX_TEAM = "team:";

type ApprovalEntity =
	| { type: "user"; id: Id<"users"> }
	| { type: "team"; id: Id<"teams"> };

const APPROVAL_CONFIG = {
	user: { prefix: APPROVAL_PREFIX_USER },
	team: { prefix: APPROVAL_PREFIX_TEAM },
} as const;

export function encodeApprovalId(
	type: "user" | "team",
	id: Id<"users"> | Id<"teams">,
): string {
	return `${APPROVAL_CONFIG[type].prefix}${id}`;
}

export function decodeApprovalId(encoded: string): ApprovalEntity | null {
	if (encoded.startsWith(APPROVAL_PREFIX_USER)) {
		return {
			type: "user",
			id: encoded.slice(APPROVAL_PREFIX_USER.length) as Id<"users">,
		};
	}
	if (encoded.startsWith(APPROVAL_PREFIX_TEAM)) {
		return {
			type: "team",
			id: encoded.slice(APPROVAL_PREFIX_TEAM.length) as Id<"teams">,
		};
	}
	return null;
}

function partitionApprovalIds(encodedIds: string[]): {
	userIds: Id<"users">[];
	teamIds: Id<"teams">[];
	invalid: string[];
} {
	return encodedIds.reduce(
		(acc, encoded) => {
			const decoded = decodeApprovalId(encoded);
			if (!decoded) {
				acc.invalid.push(encoded);
			} else if (decoded.type === "user") {
				acc.userIds.push(decoded.id);
			} else {
				acc.teamIds.push(decoded.id);
			}
			return acc;
		},
		{
			userIds: [] as Id<"users">[],
			teamIds: [] as Id<"teams">[],
			invalid: [] as string[],
		},
	);
}

export async function getPotentialReviewerUserIds(
	ctx: MutationCtx,
	requiredApprovalIds: string[] | undefined,
): Promise<Set<Id<"users">>> {
	const userIds = new Set<Id<"users">>();
	if (!requiredApprovalIds?.length) return userIds;

	const { userIds: directUserIds, teamIds } =
		partitionApprovalIds(requiredApprovalIds);

	for (const id of directUserIds) {
		userIds.add(id);
	}

	if (teamIds.length > 0) {
		const teamDocs = await Promise.all(
			teamIds.map((id) => ctx.db.get("teams", id)),
		);

		for (const team of teamDocs) {
			if (team) {
				for (const memberId of team.memberIds) {
					userIds.add(memberId);
				}
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
): Promise<void> {
	if (!requiredApprovalIds?.length) return;

	const reviewerIds = await getPotentialReviewerUserIds(
		ctx,
		requiredApprovalIds,
	);
	reviewerIds.delete(actorId);

	if (reviewerIds.size === 0) return;

	await emitNotificationEvent(ctx, {
		type: "task_awaiting_review",
		taskId,
		recipientIds: [...reviewerIds],
		actorId,
		eventKey: `${taskId}:awaiting-review:${Date.now()}`,
	});
}

export async function computeApprovalCompleteness(
	ctx: Pick<MutationCtx, "db">,
	requiredApprovalIds: string[],
	approvedByIds: Id<"users">[],
): Promise<{ isFullyApproved: boolean; pendingKeys: string[] }> {
	if (requiredApprovalIds.length === 0) {
		return { isFullyApproved: true, pendingKeys: [] };
	}

	const approvingUserIds = new Set(approvedByIds);
	const {
		userIds: requiredUserIds,
		teamIds: requiredTeamIds,
		invalid,
	} = partitionApprovalIds(requiredApprovalIds);

	const pendingKeys: string[] = [...invalid];

	const pendingUsers = requiredUserIds.filter(
		(id) => !approvingUserIds.has(id),
	);
	for (const id of pendingUsers) {
		pendingKeys.push(encodeApprovalId("user", id));
	}

	if (requiredTeamIds.length > 0) {
		const teamDocs = await Promise.all(
			requiredTeamIds.map((id) => ctx.db.get("teams", id)),
		);

		const teamApprovals = requiredTeamIds.map((teamId, index) => ({
			teamId,
			team: teamDocs[index],
			encoded: encodeApprovalId("team", teamId),
		}));

		for (const { team, encoded } of teamApprovals) {
			if (!team) {
				pendingKeys.push(encoded);
				continue;
			}

			const teamMemberIds = new Set(team.memberIds);
			const hasApprovingMember = [...approvingUserIds].some((userId) =>
				teamMemberIds.has(userId),
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
			get: (id: Id<"users"> | Id<"teams">) => Promise<
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
	approvedByIds: Id<"users">[],
	usersMap: Map<
		Id<"users">,
		{ id: Id<"users">; name: string; avatarUrl: string }
	>,
	teamsMap: Map<
		Id<"teams">,
		{
			id: Id<"teams">;
			name: string;
			members: Array<{ id: Id<"users">; name: string; avatarUrl: string }>;
		}
	>,
): {
	requiredApprovalBy: Array<
		| { id: Id<"users">; name: string; avatarUrl: string }
		| {
				id: Id<"teams">;
				name: string;
				members: Array<{ id: Id<"users">; name: string; avatarUrl: string }>;
		  }
	>;
	approvedBy: Array<{ id: Id<"users">; name: string; avatarUrl: string }>;
} {
	const requiredApprovalBy: Array<
		| { id: Id<"users">; name: string; avatarUrl: string }
		| {
				id: Id<"teams">;
				name: string;
				members: Array<{ id: Id<"users">; name: string; avatarUrl: string }>;
		  }
	> = [];

	const entityResolvers = {
		user: (id: Id<"users">) => usersMap.get(id),
		team: (id: Id<"teams">) => teamsMap.get(id),
	};

	for (const encoded of requiredApprovalIds) {
		const decoded = decodeApprovalId(encoded);
		if (!decoded) continue;

		const entity =
			decoded.type === "user"
				? entityResolvers.user(decoded.id)
				: entityResolvers.team(decoded.id);
		if (entity) requiredApprovalBy.push(entity);
	}

	const approvedBy = approvedByIds
		.map((userId) => usersMap.get(userId))
		.filter(
			(u): u is { id: Id<"users">; name: string; avatarUrl: string } =>
				u !== undefined,
		);

	return { requiredApprovalBy, approvedBy };
}
