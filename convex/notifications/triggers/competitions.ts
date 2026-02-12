import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { collectCompetitionRecipients } from "../lib/recipientCollection";
import { emitNotificationEvent } from "../../notifications";

export async function sendCompetitionPhaseChangeNotifications(
	ctx: MutationCtx,
	args: {
		competition: Doc<"competitions">;
		competitionId: Id<"competitions">;
		actorId: Id<"users">;
		oldPhaseName: string;
		newPhaseName: string;
	},
): Promise<void> {
	const recipientIds = collectCompetitionRecipients(
		args.competition,
		args.actorId,
	);
	if (recipientIds.length === 0) {
		return;
	}
	await emitNotificationEvent(ctx, {
		type: "competition_phase_changed",
		competitionId: args.competitionId,
		recipientIds,
		actorId: args.actorId,
		oldPhaseName: args.oldPhaseName,
		newPhaseName: args.newPhaseName,
		eventKey: `${args.competitionId}:${args.oldPhaseName}:${args.newPhaseName}:${Date.now()}`,
	});
}

export async function sendProgressUpdateNotifications(
	ctx: MutationCtx,
	args: {
		competition: Doc<"competitions">;
		competitionId: Id<"competitions">;
		updateId: Id<"competitionUpdates">;
		actorId: Id<"users">;
		competitionName: string;
		status: "on-track" | "at-risk" | "off-track";
	},
): Promise<void> {
	const recipientIds = collectCompetitionRecipients(
		args.competition,
		args.actorId,
	);
	if (recipientIds.length === 0) {
		return;
	}
	await emitNotificationEvent(ctx, {
		type: "progress_update_added",
		competitionId: args.competitionId,
		recipientIds,
		actorId: args.actorId,
		competitionName: args.competitionName,
		status: args.status,
		eventKey: `${args.updateId}:progress-update:${Date.now()}`,
	});
}
