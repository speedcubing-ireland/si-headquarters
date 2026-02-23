"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { format } from "date-fns";
import { Calendar, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	usePendingRemindersForTask,
	useReminderMutations,
} from "@/hooks/use-convex-data";
import { RemindMeDialog } from "@/components/tasks/remind-me-dialog";
import { onMutationError } from "@/lib/utils";
import type { Task } from "@/data/types-new";

interface TaskReminderStripProps {
	task: Task;
}

export function TaskReminderStrip({ task }: TaskReminderStripProps) {
	const { reminders: pendingForTask } = usePendingRemindersForTask(task.id);
	const { cancelReminder, rescheduleReminder } = useReminderMutations();
	const [rescheduleReminderId, setRescheduleReminderId] =
		useState<Id<"reminders"> | null>(null);

	const nextReminder = pendingForTask[0];

	const handleReschedule = (reminderId: Id<"reminders">, remindAt: string) => {
		void rescheduleReminder(reminderId, remindAt).catch(onMutationError);
		setRescheduleReminderId(null);
	};

	if (pendingForTask.length === 0) return null;

	return (
		<>
			<div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm">
				<Calendar className="size-4 shrink-0 text-warning" />
				<span className="min-w-0 flex-1 text-warning">
					Reminder
					{nextReminder &&
						` • ${format(new Date(nextReminder.remindAt), "PPp")}`}
				</span>
				<div className="ml-auto flex w-full items-center justify-end gap-1 sm:w-auto">
					<Button
						variant="ghost"
						size="sm"
						className="text-xs"
						onClick={() => {
							setRescheduleReminderId(nextReminder?.id ?? null);
						}}
					>
						Reschedule
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="text-xs"
						onClick={() => {
							if (!nextReminder) return;
							void cancelReminder(nextReminder.id).catch(onMutationError);
						}}
					>
						<X className="size-3.5" />
						Cancel
					</Button>
				</div>
			</div>
			<RemindMeDialog
				open={rescheduleReminderId !== null}
				onOpenChange={(open) => !open && setRescheduleReminderId(null)}
				taskId={task.id}
				mode="reschedule"
				reminderId={rescheduleReminderId ?? undefined}
				onReschedule={handleReschedule}
			/>
		</>
	);
}
