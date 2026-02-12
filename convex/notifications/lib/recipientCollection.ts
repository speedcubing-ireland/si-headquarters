import type { Id } from "../../_generated/dataModel";

export function collectTaskRecipients(
	task: {
		assigneeId?: Id<"users">;
		ownerId?: Id<"users"> | Id<"teams">;
		ownerType?: "user" | "team";
	},
	actorId: Id<"users">,
	excludedIds?: Set<Id<"users">>,
): Id<"users">[] {
	const recipients = new Set<Id<"users">>();

	if (
		task.assigneeId &&
		task.assigneeId !== actorId &&
		!excludedIds?.has(task.assigneeId)
	) {
		recipients.add(task.assigneeId);
	}

	if (
		task.ownerType === "user" &&
		task.ownerId &&
		task.ownerId !== actorId &&
		!excludedIds?.has(task.ownerId as Id<"users">)
	) {
		recipients.add(task.ownerId as Id<"users">);
	}

	return [...recipients];
}

export function collectCompetitionRecipients(
	competition: {
		compLeadId?: Id<"users">;
		leadDelegateId?: Id<"users">;
		organiserIds: Id<"users">[];
	},
	actorId: Id<"users">,
): Id<"users">[] {
	const recipients = new Set<Id<"users">>();
	if (competition.compLeadId) recipients.add(competition.compLeadId);
	if (competition.leadDelegateId) recipients.add(competition.leadDelegateId);
	for (const organiserId of competition.organiserIds) {
		recipients.add(organiserId);
	}
	recipients.delete(actorId);
	return [...recipients];
}
