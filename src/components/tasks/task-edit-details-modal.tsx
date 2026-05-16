import { useEffect, useState } from "react";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Task } from "@/data/types-new";

export function TaskEditDetailsModal({
	task,
	open,
	onOpenChange,
	onSave,
}: {
	task: Task;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (payload: { title: string; description: string }) => void;
}) {
	const [titleDraft, setTitleDraft] = useState(task.title);
	const [descriptionDraft, setDescriptionDraft] = useState(
		task.description ?? "",
	);

	useEffect(() => {
		if (open) return;
		setTitleDraft(task.title);
		setDescriptionDraft(task.description ?? "");
	}, [open, task.description, task.title]);

	return (
		<ResponsiveModal
			open={open}
			onOpenChange={onOpenChange}
			dialogContentClassName="max-w-2xl p-0"
			sheetContentClassName="p-0"
		>
			<div className="border-b border-border/70 px-5 py-4">
				<div className="text-lg font-semibold tracking-tight">Edit task</div>
				<div className="mt-1 text-sm text-muted-foreground">
					Update the task title and description.
				</div>
			</div>
			<div className="space-y-4 px-5 py-4">
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="task-title">
						Title
					</label>
					<Input
						id="task-title"
						value={titleDraft}
						onChange={(event) => setTitleDraft(event.target.value)}
						placeholder="Task title"
						autoFocus
					/>
				</div>
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="task-description">
						Description
					</label>
					<Textarea
						id="task-description"
						value={descriptionDraft}
						onChange={(event) => setDescriptionDraft(event.target.value)}
						placeholder="Write a description..."
						className="min-h-32 resize-none"
					/>
				</div>
			</div>
			<div className="flex flex-col-reverse gap-2 border-t border-border/70 px-5 py-4 sm:flex-row sm:justify-end">
				<Button variant="outline" onClick={() => onOpenChange(false)}>
					Cancel
				</Button>
				<Button
					onClick={() =>
						onSave({
							title: titleDraft,
							description: descriptionDraft,
						})
					}
				>
					Save changes
				</Button>
			</div>
		</ResponsiveModal>
	);
}
