import type { QueryCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { formatCompetitionName } from "./format";
import { decodeApprovalId } from "./approvalLogic";

export type UserRef = { id: Id<"users">; name: string; avatarUrl: string };
export type TeamRef = {
	id: Id<"teams">;
	name: string;
	members: UserRef[];
};
export type LabelRef = { id: Id<"labels">; name: string; color: string };
export type PhaseRef = { id: Id<"phases">; name: string; description: string };

export interface TaskEntityMaps {
	usersMap: Map<Id<"users">, UserRef>;
	teamsMap: Map<Id<"teams">, TeamRef>;
	approvalTeamsMap: Map<Id<"teams">, TeamRef>;
	labelsMap: Map<Id<"labels">, LabelRef>;
	phasesMap: Map<Id<"phases">, PhaseRef>;
	taskIdToTitle: Map<Id<"tasks">, string>;
	competitionIdToName: Map<Id<"competitions">, string>;
}

export async function hydrateTaskEntities(
	ctx: QueryCtx,
	tasks: Doc<"tasks">[],
): Promise<TaskEntityMaps> {
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

	const labelsMap = new Map<Id<"labels">, LabelRef>();
	labelArr.forEach((id, i) => {
		const l = labelDocs[i];
		if (l) labelsMap.set(id, { id, name: l.name, color: l.color });
	});

	const usersMap = new Map<Id<"users">, UserRef>();
	userArr.forEach((id, i) => {
		const u = userDocs[i];
		if (u)
			usersMap.set(id, { id, name: u.name ?? "", avatarUrl: u.image ?? "" });
	});

	const memberIds = new Set<Id<"users">>();
	for (const t of [...teamDocs, ...approvalTeamDocs]) {
		if (t) {
			for (const mid of t.memberIds) {
				memberIds.add(mid);
			}
		}
	}
	const memberDocs = await Promise.all(
		[...memberIds].map((id) => ctx.db.get("users", id)),
	);
	const memberMap = new Map<Id<"users">, UserRef>();
	[...memberIds].forEach((id, i) => {
		const u = memberDocs[i];
		if (u)
			memberMap.set(id, { id, name: u.name ?? "", avatarUrl: u.image ?? "" });
	});

	function buildTeamRefMap(
		ids: Id<"teams">[],
		docs: (Doc<"teams"> | null)[],
	): Map<Id<"teams">, TeamRef> {
		const map = new Map<Id<"teams">, TeamRef>();
		ids.forEach((id, i) => {
			const t = docs[i];
			if (t)
				map.set(id, {
					id,
					name: t.name,
					members: t.memberIds
						.map((mid) => memberMap.get(mid))
						.filter((u): u is UserRef => Boolean(u)),
				});
		});
		return map;
	}

	const teamsMap = buildTeamRefMap(teamArr, teamDocs);
	const approvalTeamsMap = buildTeamRefMap(approvalTeamArr, approvalTeamDocs);

	const phasesMap = new Map<Id<"phases">, PhaseRef>();
	phaseArr.forEach((id, i) => {
		const p = phaseDocs[i];
		if (p) phasesMap.set(id, { id, name: p.name, description: p.description });
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

	return {
		usersMap,
		teamsMap,
		approvalTeamsMap,
		labelsMap,
		phasesMap,
		taskIdToTitle,
		competitionIdToName,
	};
}
