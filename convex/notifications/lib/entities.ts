import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { resolveHqSiteBaseUrl } from "../../lib/siteUrls";
import type { NotificationEntityRef } from "./notificationTypes";

export function buildNotificationEntityUrl(
	entity: NotificationEntityRef,
): string | undefined {
	const baseUrl = resolveHqSiteBaseUrl();
	switch (entity.entityType) {
		case "task":
			return `${baseUrl}/tasks/${entity.entityId}`;
		case "competition":
			return `${baseUrl}/competitions/${entity.entityId}`;
		case "comment":
		case "reminder":
			return entity.parentTaskId
				? `${baseUrl}/tasks/${entity.parentTaskId}`
				: undefined;
	}
}

export async function getTaskForNotificationEntity(
	ctx: Pick<MutationCtx, "db">,
	entity: NotificationEntityRef,
): Promise<Doc<"tasks"> | null> {
	if (entity.entityType === "task") {
		return await ctx.db.get("tasks", entity.entityId);
	}
	if (
		(entity.entityType === "comment" || entity.entityType === "reminder") &&
		entity.parentTaskId
	) {
		return await ctx.db.get("tasks", entity.parentTaskId);
	}
	return null;
}

export async function getCompetitionForNotificationEntity(
	ctx: Pick<MutationCtx, "db">,
	entity: NotificationEntityRef,
): Promise<Doc<"competitions"> | null> {
	if (entity.entityType === "competition") {
		return await ctx.db.get("competitions", entity.entityId);
	}
	const task = await getTaskForNotificationEntity(ctx, entity);
	if (!task?.parentCompetitionId) {
		return null;
	}
	return await ctx.db.get("competitions", task.parentCompetitionId);
}

export async function resolveDiscordChannelForEntity(
	ctx: Pick<MutationCtx, "db">,
	entity: NotificationEntityRef,
): Promise<Doc<"competitions">["discordChannel"] | null> {
	const competition = await getCompetitionForNotificationEntity(ctx, entity);
	return competition?.discordChannel ?? null;
}
