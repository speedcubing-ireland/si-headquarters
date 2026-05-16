import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { Task } from "@/data/types-new";
import { useTaskMutations } from "@/hooks/use-convex-data";
import { onMutationError } from "@/lib/utils";

function formatLocalDateForStorage(date: Date): string {
	return format(date, "yyyy-MM-dd");
}

export function TaskDueDateControl({ task }: { task: Task }) {
	const { updateTask } = useTaskMutations();
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="w-full justify-start font-normal"
				>
					{task.dueDate
						? format(new Date(task.dueDate), "MMM d, yyyy")
						: "Set due date..."}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					selected={task.dueDate ? new Date(task.dueDate) : undefined}
					onSelect={(date) => {
						void updateTask(task.id, {
							dueDate: date ? formatLocalDateForStorage(date) : null,
						}).catch(onMutationError);
						setOpen(false);
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}
