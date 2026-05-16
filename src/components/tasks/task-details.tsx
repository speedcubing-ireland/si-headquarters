import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { TaskApprovalsPanel } from "@/components/tasks/task-approvals-panel";
import { TaskDependenciesPanel } from "@/components/tasks/task-dependencies-panel";
import { TaskEditDetailsModal } from "@/components/tasks/task-edit-details-modal";
import { TaskInfoPanel } from "@/components/tasks/task-info-panel";
import { TaskOverviewPanel } from "@/components/tasks/task-overview-panel";
import type { Task } from "@/data/types-new";

export function TaskDetails({
	task,
	isSubscribed,
	onToggleSubscription,
	onRemindMe,
	onUpdate,
	onDelete,
}: {
	task: Task;
	isSubscribed: boolean;
	onToggleSubscription: () => void;
	onRemindMe: () => void;
	onUpdate?: (updates: Partial<Task>) => void;
	onDelete?: () => void;
}) {
	const [editModalOpen, setEditModalOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	const canEdit = task.canEdit && typeof onUpdate === "function";
	const canDelete = typeof onDelete === "function";

	const handleSaveDetails = ({
		title,
		description,
	}: {
		title: string;
		description: string;
	}) => {
		if (!canEdit) return;
		const trimmedTitle = title.trim();
		if (!trimmedTitle) {
			toast.error("Task title is required");
			return;
		}
		onUpdate({
			title: trimmedTitle,
			description: description.trim(),
		});
		setEditModalOpen(false);
	};

	return (
		<section className="space-y-5 sm:space-y-6">
			<TaskOverviewPanel
				task={task}
				isSubscribed={isSubscribed}
				canEdit={canEdit}
				canDelete={canDelete}
				onToggleSubscription={onToggleSubscription}
				onRemindMe={onRemindMe}
				onEditDetails={() => setEditModalOpen(true)}
				onDelete={() => setDeleteDialogOpen(true)}
			/>

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
				<TaskInfoPanel task={task} />
				<div className="space-y-5">
					<TaskDependenciesPanel task={task} />
					<TaskApprovalsPanel task={task} />
				</div>
			</div>

			<TaskEditDetailsModal
				task={task}
				open={editModalOpen}
				onOpenChange={setEditModalOpen}
				onSave={handleSaveDetails}
			/>

			<ConfirmDeleteDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				title="Delete task?"
				description={`This will permanently delete "${task.title}" and cannot be undone.`}
				onConfirm={() => {
					void onDelete?.();
				}}
			/>
		</section>
	);
}
