"use client";

import { format } from "date-fns";
import { Calendar, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	usePendingRemindersForTask,
	useReminderMutations,
} from "@/hooks/use-convex-data";
import { RemindMeDialog } from "@/components/tasks/remind-me-dialog";
import type { Task } from "@/data/types-new";

interface TaskReminderStripProps {
	task: Task;
}

export function TaskReminderStrip({ task }: TaskReminderStripProps) {
	const { reminders: pendingForTask } = usePendingRemindersForTask(task.id);
	const { cancelReminder, rescheduleReminder } = useReminderMutations();
	const [rescheduleReminderId, setRescheduleReminderId] = useState<
		string | null
	>(null);

	const nextReminder = pendingForTask[0];

	const handleReschedule = (reminderId: string, remindAt: string) => {
		void rescheduleReminder(reminderId, remindAt);
		setRescheduleReminderId(null);
	};

	if (pendingForTask.length === 0) return null;

	return (
		<>
			<div className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
				<Calendar className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
				<span className="text-muted-foreground">
					Reminder
					{nextReminder &&
						` • ${format(new Date(nextReminder.remindAt), "PPp")}`}
				</span>
				<div className="ml-auto flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						className="h-7 text-xs"
						onClick={() => {
							setRescheduleReminderId(nextReminder?.id ?? null);
						}}
					>
						Reschedule
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 text-xs"
						onClick={() => nextReminder && cancelReminder(nextReminder.id)}
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
