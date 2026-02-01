import { createFileRoute } from "@tanstack/react-router";
import {
	Archive,
	ArchiveRestore,
	ArrowLeft,
	ChevronDown,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ListPageLayout } from "@/components/shared/list-page-layout";
import { TasksDataTable } from "@/components/tasks/data-table";
import { useTaskColumns } from "@/components/tasks/columns";
import { TasksDisplaySettings } from "@/components/tasks/display-settings";
import { TasksFilterChips } from "@/components/tasks/filter-chips";
import { TasksFilterPopover } from "@/components/tasks/filter-popover";
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
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDataV2 } from "@/data/data-store-v2";
import { useListPageState } from "@/hooks/use-list-page-state";
import { useTasksDisplaySettingsStore } from "@/store/tasks-display-settings-store";
import { useTasksFilterStore } from "@/store/tasks-filter-store";
import { useTasksSavedViews } from "@/store/use-tasks-saved-views";

export const Route = createFileRoute("/tasks/archived")({
	component: RouteComponent,
});

function PageHeader({ onBack }: { onBack: () => void }) {
	return (
		<header className="flex min-h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:min-h-12">
			<div className="flex w-full min-w-0 flex-wrap items-center gap-1 px-4 py-2 lg:gap-2 lg:px-6">
				<Button variant="outline" size="sm" onClick={onBack}>
					<ArrowLeft className="size-4 mr-2" />
					<span className="hidden sm:inline">Back to Tasks</span>
				</Button>
				<Separator
					orientation="vertical"
					className="mx-2 data-[orientation=vertical]:h-4"
				/>
				<div className="flex items-center gap-2">
					<Archive className="size-5 text-muted-foreground" />
					<span className="font-medium hidden sm:inline">Archived Tasks</span>
					<span className="font-medium sm:hidden">Archived</span>
				</div>
				<div className="ml-auto flex items-center gap-2">
					<SidebarTrigger />
				</div>
			</div>
		</header>
	);
}

function Filters() {
	const matchMode = useTasksFilterStore((state) => state.matchMode);
	const toggleMatchMode = useTasksFilterStore((state) => state.toggleMatchMode);
	const hasActiveFilters = useTasksFilterStore(
		(state) => state.hasActiveFilters,
	);
	const clearFilters = useTasksFilterStore((state) => state.clearFilters);

	return (
		<>
			<div className="flex items-center gap-2 shrink-0">
				<TasksFilterPopover />
			</div>
			<div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
				<TasksFilterChips />
			</div>
			<div className="flex items-center gap-2 shrink-0">
				<TasksDisplaySettings />
				{hasActiveFilters() && (
					<Button variant="ghost" size="sm" onClick={clearFilters}>
						Clear
					</Button>
				)}
				{hasActiveFilters() && (
					<Button variant="ghost" size="sm" onClick={toggleMatchMode}>
						<span className="hidden sm:inline">
							{matchMode === "any" ? "Match any" : "Match all"}
						</span>
					</Button>
				)}
			</div>
		</>
	);
}

function ArchivedBulkActionsBar({
	selectedTaskIds,
	onClearSelection,
	onUnarchive,
	onDelete,
}: {
	selectedTaskIds: string[];
	onClearSelection: () => void;
	onUnarchive: () => void;
	onDelete: () => void;
}) {
	if (selectedTaskIds.length === 0) return null;

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
			<div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3 max-w-full">
				{/* Selection info */}
				<div className="flex items-center gap-2 sm:gap-3 shrink-0">
					<span className="text-sm font-medium text-foreground">
						{selectedTaskIds.length}{" "}
						<span className="hidden sm:inline">
							{selectedTaskIds.length === 1 ? "task" : "tasks"} selected
						</span>
					</span>
					<button
						type="button"
						onClick={onClearSelection}
						className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						<span className="hidden sm:inline">Clear</span>
						<span className="sm:hidden">×</span>
					</button>
				</div>

				<div className="h-4 w-px bg-border shrink-0" />

				{/* Mobile Actions Dropdown */}
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

				{/* Desktop Actions */}
				<div className="hidden sm:flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={onUnarchive}
						disabled={selectedTaskIds.length === 0}
					>
						<ArchiveRestore className="size-4 mr-2" />
						Unarchive
					</Button>
					<Button
						variant="destructive"
						size="sm"
						onClick={onDelete}
						disabled={selectedTaskIds.length === 0}
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
	const columns = useTaskColumns();
	const navigate = Route.useNavigate();
	const archivedTasks = useDataV2((state) => state.archivedTasks);
	const bulkUnarchiveTasks = useDataV2((state) => state.bulkUnarchiveTasks);
	const permanentlyDeleteTasks = useDataV2(
		(state) => state.permanentlyDeleteTasks,
	);
	const currentUser = useDataV2((state) => state.users[0]);

	const savedViews = useTasksSavedViews();
	const listState = useListPageState({
		filterStore: useTasksFilterStore,
		displayStore: useTasksDisplaySettingsStore,
		savedViews,
	});

	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	// Keyboard shortcut: Esc to clear selection
	useEffect(() => {
		const keyHandler = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
				return;
			}

			if (event.key === "Escape" && listState.hasSelection) {
				event.preventDefault();
				listState.clearRowSelection();
			}
		};

		window.addEventListener("keydown", keyHandler);
		return () => window.removeEventListener("keydown", keyHandler);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [listState.hasSelection, listState.clearRowSelection]);

	const handleUnarchive = () => {
		if (listState.selectedIds.length === 0) return;
		bulkUnarchiveTasks(listState.selectedIds, currentUser);
		// Selection will be automatically cleared when tasks disappear from archived list
	};

	const handleDeleteClick = () => {
		if (listState.selectedIds.length === 0) return;
		setIsDeleteDialogOpen(true);
	};

	const handleConfirmDelete = () => {
		permanentlyDeleteTasks(listState.selectedIds);
		setIsDeleteDialogOpen(false);
		// Selection will be automatically cleared when tasks are deleted
	};

	const handleBackToTasks = () => {
		// Clear filters when leaving archived page
		useTasksFilterStore.getState().clearFilters();
		useTasksDisplaySettingsStore.getState().fromJSON(
			JSON.stringify({
				grouping: null,
				subGrouping: null,
				ordering: { field: null, direction: "asc" },
			}),
		);
		navigate({ to: "/tasks" });
	};

	return (
		<>
			<ListPageLayout
				header={<PageHeader onBack={handleBackToTasks} />}
				filtersRow={<Filters />}
				table={
					archivedTasks.length === 0 ? (
						<div className="flex items-center justify-center h-full">
							<div className="text-center">
								<Archive className="size-12 text-muted-foreground/30 mx-auto mb-4" />
								<h3 className="text-lg font-medium text-muted-foreground">
									No archived tasks
								</h3>
								<p className="text-sm text-muted-foreground mt-1">
									Archived tasks will appear here
								</p>
							</div>
						</div>
					) : (
						<TasksDataTable
							columns={columns}
							tasks={
								archivedTasks as unknown as import("@/data/types-new").Task[]
							}
							enableRowSelection={true}
							rowSelection={listState.rowSelection}
							onRowSelectionChange={listState.setRowSelection}
							autoHideRowSelection={true}
							skipClientFiltering={true}
						/>
					)
				}
				modal={null}
				createView={{
					isCreatingView: false,
					viewName: "",
					setViewName: () => {},
					viewDescription: "",
					setViewDescription: () => {},
					onCancelCreateView: () => {},
					onSaveView: () => {},
				}}
			/>
			<ArchivedBulkActionsBar
				selectedTaskIds={listState.selectedIds}
				onClearSelection={listState.clearRowSelection}
				onUnarchive={handleUnarchive}
				onDelete={handleDeleteClick}
			/>
			<DeleteConfirmDialog
				isOpen={isDeleteDialogOpen}
				onClose={() => setIsDeleteDialogOpen(false)}
				onConfirm={handleConfirmDelete}
				count={listState.selectedIds.length}
			/>
		</>
	);
}
