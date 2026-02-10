import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { collectTaskRecipients } from "./lib/recipientCollection";

export async function sendMentionNotifications(
	ctx: MutationCtx,
	args: {
		taskId: Id<"tasks">;
		commentId: Id<"comments">;
		mentionedUserIds: Id<"users">[];
		actorId: Id<"users">;
	},
): Promise<Set<Id<"users">>> {
	const notified = new Set<Id<"users">>();
	for (const mentionedUserId of args.mentionedUserIds) {
		if (mentionedUserId !== args.actorId) {
			await ctx.scheduler.runAfter(
				0,
				internal.notifications._notifyTaskMentioned,
				{
					taskId: args.taskId,
					commentId: args.commentId,
					mentionedUserId,
					actorId: args.actorId,
				},
			);
			notified.add(mentionedUserId);
		}
	}
	return notified;
}

export async function sendReplyNotifications(
	ctx: MutationCtx,
	args: {
		taskId: Id<"tasks">;
		commentId: Id<"comments">;
		parentComment: Doc<"comments"> | null;
		actorId: Id<"users">;
		excludedRecipients: Set<Id<"users">>;
	},
): Promise<Set<Id<"users">>> {
	const notified = new Set<Id<"users">>();
	if (
		args.parentComment &&
		args.parentComment.authorId !== args.actorId &&
		!args.excludedRecipients.has(args.parentComment.authorId)
	) {
		notified.add(args.parentComment.authorId);
	}
	if (notified.size > 0) {
		await ctx.scheduler.runAfter(
			0,
			internal.notifications._notifyCommentReplied,
			{
				taskId: args.taskId,
				commentId: args.commentId,
				recipientIds: [...notified],
				actorId: args.actorId,
				eventKey: `${args.commentId}:reply`,
			},
		);
	}
	return notified;
}

export async function sendCommentAddedNotifications(
	ctx: MutationCtx,
	args: {
		taskId: Id<"tasks">;
		commentId: Id<"comments">;
		task: Doc<"tasks">;
		actorId: Id<"users">;
		excludedRecipients: Set<Id<"users">>;
	},
): Promise<void> {
	const recipientIds = collectTaskRecipients(
		args.task,
		args.actorId,
		args.excludedRecipients,
	);
	await ctx.scheduler.runAfter(0, internal.notifications._notifyCommentAdded, {
		taskId: args.taskId,
		commentId: args.commentId,
		recipientIds,
		actorId: args.actorId,
		eventKey: `${args.commentId}:added`,
	});
}
