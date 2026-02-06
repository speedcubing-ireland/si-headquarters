import { createFileRoute } from "@tanstack/react-router";
import { Archive, ArchiveRestore, ChevronDown, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { parseTaskId } from "@/lib/convex-ids";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TasksPage } from "@/components/tasks/tasks-page";
import { useTasksListStateContext } from "@/store/tasks-list-context";
import { useTaskMutations } from "@/hooks/use-convex-data";

function ArchivedBulkActions({
	onUnarchive,
	onDelete,
}: {
	onUnarchive: () => void;
	onDelete: () => void;
}) {
	const listState = useTasksListStateContext();
	if (listState.selectedIds.length === 0) return null;

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-t">
			<div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3 max-w-full">
				<div className="flex items-center gap-2 sm:gap-3 shrink-0">
					<span className="text-sm font-medium text-foreground">
						{listState.selectedIds.length}{" "}
						<span className="hidden sm:inline">
							{listState.selectedIds.length === 1 ? "task" : "tasks"} selected
						</span>
					</span>
					<button
						type="button"
						onClick={listState.clearRowSelection}
						className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						<span className="hidden sm:inline">Clear</span>
						<span className="sm:hidden">×</span>
					</button>
				</div>

				<div className="h-4 w-px bg-border shrink-0" />

				<div className="sm:hidden flex items-center gap-1">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="h-8 gap-1 px-2">
								<span>Actions</span>
								<ChevronDown className="size-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-48">
							<DropdownMenuItem onClick={onUnarchive}>
								<ArchiveRestore className="size-4 mr-2" />
								Unarchive
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={onDelete}
								className="text-destructive focus:text-destructive"
							>
								<Trash2 className="size-4 mr-2" />
								Delete Permanently
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div className="hidden sm:flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={onUnarchive}
						disabled={listState.selectedIds.length === 0}
					>
						<ArchiveRestore className="size-4 mr-2" />
						Unarchive
					</Button>
					<Button
						variant="destructive"
						size="sm"
						onClick={onDelete}
						disabled={listState.selectedIds.length === 0}
					>
						<Trash2 className="size-4 mr-2" />
						Delete Permanently
					</Button>
				</div>
			</div>
		</div>
	);
}

function DeleteConfirmDialog({
	isOpen,
	onClose,
	onConfirm,
	count,
}: {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	count: number;
}) {
	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete Tasks Permanently</DialogTitle>
					<DialogDescription>
						Are you sure you want to permanently delete {count} task
						{count === 1 ? "" : "s"}? This action cannot be undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="destructive" onClick={onConfirm}>
						Delete Permanently
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function RouteComponent() {
	const { bulkUnarchiveTasks, permanentlyDeleteTasks } = useTaskMutations();

	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

	const taskIds = (ids: string[]) =>
		ids
			.map((id) => parseTaskId(id))
			.filter((id): id is Id<"tasks"> => id !== null);

	const handleUnarchive = (selectedIds: string[]) => {
		if (selectedIds.length === 0) return;
		void bulkUnarchiveTasks(taskIds(selectedIds));
	};

	const handleDeleteClick = (selectedIds: string[]) => {
		if (selectedIds.length === 0) return;
		setPendingDeleteIds(selectedIds);
		setIsDeleteDialogOpen(true);
	};

	const handleConfirmDelete = () => {
		void permanentlyDeleteTasks(taskIds(pendingDeleteIds));
		setIsDeleteDialogOpen(false);
		setPendingDeleteIds([]);
	};

	return (
		<TasksPage
			pageId="archived"
			pageTitle="Archived Tasks"
			pageIcon={Archive}
			taskSource="archived"
			showCreateButton={false}
			bulkActions={
				<ArchivedBulkActionsContainer
					onUnarchive={handleUnarchive}
					onDeleteClick={handleDeleteClick}
					isDeleteDialogOpen={isDeleteDialogOpen}
					onCloseDialog={() => setIsDeleteDialogOpen(false)}
					onConfirmDelete={handleConfirmDelete}
					pendingDeleteCount={pendingDeleteIds.length}
				/>
			}
		/>
	);
}

function ArchivedBulkActionsContainer({
	onUnarchive,
	onDeleteClick,
	isDeleteDialogOpen,
	onCloseDialog,
	onConfirmDelete,
	pendingDeleteCount,
}: {
	onUnarchive: (ids: string[]) => void;
	onDeleteClick: (ids: string[]) => void;
	isDeleteDialogOpen: boolean;
	onCloseDialog: () => void;
	onConfirmDelete: () => void;
	pendingDeleteCount: number;
}) {
	const listState = useTasksListStateContext();
	return (
		<>
			<ArchivedBulkActions
				onUnarchive={() => onUnarchive(listState.selectedIds)}
				onDelete={() => onDeleteClick(listState.selectedIds)}
			/>
			<DeleteConfirmDialog
				isOpen={isDeleteDialogOpen}
				onClose={onCloseDialog}
				onConfirm={onConfirmDelete}
				count={pendingDeleteCount}
			/>
		</>
	);
}

export const Route = createFileRoute("/tasks/archived")({
	component: RouteComponent,
});
