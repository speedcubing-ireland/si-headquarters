import type { Id, Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { NOTIFICATION_DEFAULTS } from "../lib/constants";
import { emitDueDateNotificationsForTask } from "../notifications";

const dublinDateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: NOTIFICATION_DEFAULTS.TIMEZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

function toDublinDateKey(timestamp: number): string {
	return dublinDateFormatter.format(new Date(timestamp));
}

function isDublinDateToday(dateValue: string, now: number): boolean {
	const dueDateMs = new Date(dateValue).getTime();
	if (Number.isNaN(dueDateMs)) {
		return false;
	}
	return toDublinDateKey(dueDateMs) === toDublinDateKey(now);
}

export async function maybeTriggerDueDateCheckForToday(
	ctx: MutationCtx,
	args: {
		taskId: Id<"tasks">;
		dueDate: string | undefined;
		assigneeId: Id<"users"> | undefined;
		status: Doc<"tasks">["status"];
	},
): Promise<void> {
	if (!args.dueDate || !args.assigneeId || args.status === "done") {
		return;
	}

	const now = Date.now();
	if (!isDublinDateToday(args.dueDate, now)) {
		return;
	}

	await emitDueDateNotificationsForTask(ctx, args.taskId, now);
}
