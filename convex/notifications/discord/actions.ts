import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { HQ_ACTION_TOKEN_PREFIX } from "../../discord/interactions";
import { resolveHqSiteBaseUrl } from "../../lib/siteUrls";
import type { DiscordNotificationContext } from "./context";
import type { DiscordActionButtonSpec } from "./types";

export async function createDiscordActionToken(
	ctx: MutationCtx,
	args: {
		actionKind: Doc<"discordActionTokens">["actionKind"];
		userId?: Id<"users">;
		taskId?: Id<"tasks">;
		commentId?: Id<"comments">;
		reminderId?: Id<"reminders">;
		status?: Doc<"discordActionTokens">["status"];
	},
): Promise<string> {
	const token = crypto.randomUUID();
	await ctx.db.insert("discordActionTokens", {
		token,
		actionKind: args.actionKind,
		userId: args.userId,
		taskId: args.taskId,
		commentId: args.commentId,
		reminderId: args.reminderId,
		status: args.status,
		expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
		consumedAt: undefined,
		createdAt: Date.now(),
	});
	return `${HQ_ACTION_TOKEN_PREFIX}${token}`;
}

export function viewEntityAction(
	context: DiscordNotificationContext,
	labelOverride?: string,
): DiscordActionButtonSpec[] {
	if (!context.entityUrl) {
		return [];
	}
	return [
		{
			customId: context.entityUrl,
			label: labelOverride ?? defaultViewLabel(context),
			style: 5,
			url: context.entityUrl,
		},
	];
}

export async function commentOnTaskAction(
	context: DiscordNotificationContext,
): Promise<DiscordActionButtonSpec[]> {
	if (!context.task) {
		return [];
	}
	return [
		{
			customId: await createDiscordActionToken(context.ctx, {
				actionKind: "open_task_comment_modal",
				userId: context.userId,
				taskId: context.task._id,
			}),
			label: "Comment",
			style: 2,
		},
	];
}

export async function replyToCommentAction(
	context: DiscordNotificationContext,
): Promise<DiscordActionButtonSpec[]> {
	if (context.input.entity.entityType !== "comment") {
		return [];
	}
	return [
		{
			customId: await createDiscordActionToken(context.ctx, {
				actionKind: "open_task_reply_modal",
				userId: context.userId,
				taskId: context.input.entity.parentTaskId,
				commentId: context.input.entity.entityId,
			}),
			label: "Reply",
			style: 1,
		},
	];
}

export async function startTaskAction(
	context: DiscordNotificationContext,
): Promise<DiscordActionButtonSpec[]> {
	return taskStatusAction(context, {
		status: "in-progress",
		label: "Start Task",
		style: 1,
	});
}

export async function markDoneAction(
	context: DiscordNotificationContext,
): Promise<DiscordActionButtonSpec[]> {
	return taskStatusAction(context, {
		status: "done",
		label: "Mark Done",
		style: 3,
	});
}

export async function approveTaskAction(
	context: DiscordNotificationContext,
): Promise<DiscordActionButtonSpec[]> {
	if (!context.task) {
		return [];
	}
	return [
		{
			customId: await createDiscordActionToken(context.ctx, {
				actionKind: "approve_task",
				userId: context.userId,
				taskId: context.task._id,
			}),
			label: "Approve",
			style: 3,
		},
	];
}

export async function unapproveTaskAction(
	context: DiscordNotificationContext,
): Promise<DiscordActionButtonSpec[]> {
	if (!context.task) {
		return [];
	}
	return [
		{
			customId: await createDiscordActionToken(context.ctx, {
				actionKind: "unapprove_task",
				userId: context.userId,
				taskId: context.task._id,
			}),
			label: "Unapprove",
			style: 2,
		},
	];
}

export function viewTaskUrlAction(
	taskId: Id<"tasks">,
	label: string,
): DiscordActionButtonSpec[] {
	const url = `${resolveHqSiteBaseUrl()}/tasks/${taskId}`;
	return [{ customId: url, label, style: 5, url }];
}

export async function dismissAction(
	context: DiscordNotificationContext,
): Promise<DiscordActionButtonSpec> {
	return {
		customId: await createDiscordActionToken(context.ctx, {
			actionKind: "dismiss_message",
			userId: context.userId,
		}),
		label: "Dismiss",
		style: 2,
	};
}

export async function withDestinationLimits(
	context: DiscordNotificationContext,
	actions: DiscordActionButtonSpec[],
): Promise<DiscordActionButtonSpec[]> {
	if (context.destinationKind !== "dm") {
		return actions.slice(0, 5);
	}
	const dismiss = await dismissAction(context);
	return [...actions.slice(0, 4), dismiss];
}

async function taskStatusAction(
	context: DiscordNotificationContext,
	args: {
		status: Doc<"tasks">["status"];
		label: string;
		style: 1 | 2 | 3 | 4;
	},
): Promise<DiscordActionButtonSpec[]> {
	if (!context.task || context.task.status === args.status) {
		return [];
	}
	return [
		{
			customId: await createDiscordActionToken(context.ctx, {
				actionKind: "set_task_status",
				userId: context.userId,
				taskId: context.task._id,
				reminderId: context.reminderId,
				status: args.status,
			}),
			label: args.label,
			style: args.style,
		},
	];
}

function defaultViewLabel(context: DiscordNotificationContext): string {
	if (context.input.type === "progress_update_added") {
		return "View Update";
	}
	switch (context.input.entity.entityType) {
		case "competition":
			return "View Competition";
		case "comment":
			return "View Comment";
		case "reminder":
		case "task":
			return "View Task";
	}
}
