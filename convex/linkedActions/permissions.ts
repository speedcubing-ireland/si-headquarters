import { ConvexError } from "convex/values";
import type { Infer } from "convex/values";
import type { Id, Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type {
	linkedActionRunPermission,
	linkedActionType,
} from "../lib/validators";
import { requireTaskAccess } from "../taskAccess";

export async function ensureTaskAccess(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	taskId: Id<"tasks">,
	volunteer: boolean,
) {
	const task = await ctx.db.get("tasks", taskId);
	if (!task) {
		throw new ConvexError({
			code: "NOT_FOUND",
			message: "Task not found.",
		});
	}
	await requireTaskAccess(ctx, volunteer, userId, task);
	return task;
}

export async function canUserRunForTask(
	ctx: QueryCtx | MutationCtx,
	args: {
		userId: Id<"users">;
		volunteer: boolean;
		task: Doc<"tasks">;
		actionType: Infer<typeof linkedActionType>;
		runPermission: Infer<typeof linkedActionRunPermission>;
	},
): Promise<boolean> {
	if (args.actionType === "canva_template" && !args.volunteer) return false;
	if (args.runPermission === "anyone") return true;
	if (args.runPermission === "volunteer") return args.volunteer;
	if (args.runPermission === "assignee") {
		return args.task.assigneeId === args.userId;
	}

	if (args.task.ownerType === "user") {
		return args.task.ownerId === args.userId;
	}
	if (args.task.ownerType === "team") {
		const ownerTeam = await ctx.db.get(args.task.ownerId as Id<"teams">);
		return ownerTeam?.memberIds.includes(args.userId) ?? false;
	}
	return false;
}
