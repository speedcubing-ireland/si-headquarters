import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
	buildNotificationEntityUrl,
	getCompetitionForNotificationEntity,
	getTaskForNotificationEntity,
} from "../lib/entities";
import { parsePayloadJson } from "../lib/payload";
import type {
	NotificationEmitInput,
	NotificationPayload,
} from "../lib/notificationTypes";
import type { DiscordDestinationKind } from "./types";

export type DiscordNotificationContext = {
	ctx: MutationCtx;
	input: NotificationEmitInput;
	payload: NotificationPayload;
	destinationKind: DiscordDestinationKind;
	userId?: Id<"users">;
	entityUrl?: string;
	task: Doc<"tasks"> | null;
	competition: Doc<"competitions"> | null;
	comment: Doc<"comments"> | null;
	progressUpdate: Doc<"competitionUpdates"> | null;
	reminderId?: Id<"reminders">;
	actorName: string;
	actorAuthor?: { name: string; iconUrl?: string };
};

function actorAuthor(
	input: NotificationEmitInput,
): { name: string; iconUrl?: string } | undefined {
	const actorName = input.metadata?.actorName;
	if (!actorName) return undefined;
	return {
		name: actorName,
		iconUrl: input.metadata?.actorAvatarUrl,
	};
}

export async function buildDiscordNotificationContext(
	ctx: MutationCtx,
	args: {
		input: NotificationEmitInput;
		destinationKind: DiscordDestinationKind;
		userId?: Id<"users">;
	},
): Promise<DiscordNotificationContext> {
	const payload = parsePayloadJson(args.input.payloadJson);
	const task = await getTaskForNotificationEntity(ctx, args.input.entity);
	const competition = await getCompetitionForNotificationEntity(
		ctx,
		args.input.entity,
	);
	const comment =
		args.input.entity.entityType === "comment"
			? await ctx.db.get("comments", args.input.entity.entityId)
			: null;
	const progressUpdateId =
		typeof payload.updateId === "string"
			? ctx.db.normalizeId("competitionUpdates", payload.updateId)
			: null;
	const progressUpdate = progressUpdateId
		? await ctx.db.get("competitionUpdates", progressUpdateId)
		: null;
	const reminderId =
		typeof payload.reminderId === "string"
			? (ctx.db.normalizeId("reminders", payload.reminderId) ?? undefined)
			: undefined;

	return {
		ctx,
		input: args.input,
		payload,
		destinationKind: args.destinationKind,
		userId: args.userId,
		entityUrl: buildNotificationEntityUrl(args.input.entity),
		task,
		competition,
		comment,
		progressUpdate,
		reminderId,
		actorName: args.input.metadata?.actorName ?? "Someone",
		actorAuthor: actorAuthor(args.input),
	};
}
