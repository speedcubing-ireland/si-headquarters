import {
	createFileRoute,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { ListTodo, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { SharedPageHeader } from "@/components/shared/page-header";
import { taskColumns } from "@/components/tasks/columns";
import { TasksDataTable } from "@/components/tasks/data-table";
import { TasksDisplaySettings } from "@/components/tasks/display-settings";
import { TasksFilterChips } from "@/components/tasks/filter-chips";
import { TasksFilterPopover } from "@/components/tasks/filter-popover";
import { TaskModal } from "@/components/tasks/task-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTasksDisplaySettingsStore } from "@/store/tasks-display-settings-store";
import { useTasksFilterStore } from "@/store/tasks-filter-store";
import { useTasksSavedViews } from "@/store/use-tasks-saved-views";

export const Route = createFileRoute("/tasks")({
	component: RouteComponent,
});

function PageHeader({
	onAddTask,
	views,
	activeViewId,
	onViewSelect,
	onViewDelete,
	onStartCreateView,
	onAllTasks,
}: {
	onAddTask: () => void;
	views: ReturnType<typeof useTasksSavedViews>["views"];
	activeViewId: string | null;
	onViewSelect: (viewId: string) => void;
	onViewDelete: (viewId: string) => void;
	onStartCreateView: () => void;
	onAllTasks: () => void;
}) {
	return (
		<SharedPageHeader
			primaryIcon={ListTodo}
			primaryLabel="All tasks"
			addIcon={Plus}
			addLabel="Add task"
			onAdd={onAddTask}
			onPrimaryClick={onAllTasks}
			views={views}
			activeViewId={activeViewId}
			onViewSelect={onViewSelect}
			onViewDelete={onViewDelete}
			onStartCreateView={onStartCreateView}
		/>
	);
}

function Filters() {
	const matchMode = useTasksFilterStore((state) => state.matchMode);
	const toggleMatchMode = useTasksFilterStore((state) => state.toggleMatchMode);
	const hasActiveFilters = useTasksFilterStore(
		(state) => state.hasActiveFilters,
	);

	return (
		<div className="flex min-h-12 shrink-0 items-center gap-2 border-b py-2">
			<div className="flex w-full items-center gap-2 px-4 lg:px-6">
				<div className="flex items-center gap-2 shrink-0">
					<TasksFilterPopover />
				</div>
				<div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
					<TasksFilterChips />
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<TasksDisplaySettings />
					{hasActiveFilters() && (
						<Button variant="ghost" size="sm" onClick={toggleMatchMode}>
							{matchMode === "any" ? "Match any filter" : "Match all filters"}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}

function RouteComponent() {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isCreatingView, setIsCreatingView] = useState(false);
	const [viewName, setViewName] = useState("");
	const [viewDescription, setViewDescription] = useState("");
	const [previousFiltersJson, setPreviousFiltersJson] = useState<string | null>(
		null,
	);
	const [previousDisplayJson, setPreviousDisplayJson] = useState<string | null>(
		null,
	);

	const savedViews = useTasksSavedViews();
	const filterStore = useTasksFilterStore;
	const displayStore = useTasksDisplaySettingsStore;
	const matchMode = useTasksFilterStore((state) => state.matchMode);
	const toggleMatchMode = useTasksFilterStore((state) => state.toggleMatchMode);
	const hasActiveFilters = useTasksFilterStore(
		(state) => state.hasActiveFilters,
	);

	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const segments = pathname.split("/").filter(Boolean);
	const isDetailRoute = segments.length > 1 && segments[0] === "tasks";

	// Keyboard shortcut: C to create a new task (when focused in this route)
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			// Ignore when focused in inputs/textareas/selects to avoid interrupting typing
			const target = event.target as HTMLElement | null;
			if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
				return;
			}

			if (event.key.toLowerCase() === "c") {
				event.preventDefault();
				setIsModalOpen(true);
			}
		};

		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	const handleStartCreateView = () => {
		setPreviousFiltersJson(filterStore.getState().toJSON());
		setPreviousDisplayJson(displayStore.getState().toJSON());
		setViewName("");
		setViewDescription("");
		setIsCreatingView(true);
	};

	const handleCancelCreateView = () => {
		if (previousFiltersJson) {
			filterStore.getState().fromJSON(previousFiltersJson);
		}
		if (previousDisplayJson) {
			displayStore.getState().fromJSON(previousDisplayJson);
		}
		setIsCreatingView(false);
		setViewName("");
		setViewDescription("");
		setPreviousFiltersJson(null);
		setPreviousDisplayJson(null);
	};

	const handleSaveView = () => {
		if (!viewName.trim()) return;

		savedViews.createCurrentView(viewName, viewDescription || undefined);
		setIsCreatingView(false);
		setViewName("");
		setViewDescription("");
		setPreviousFiltersJson(null);
		setPreviousDisplayJson(null);
	};

	const handleViewSelect = (viewId: string) => {
		savedViews.applyView(viewId);
	};

	const handleAllTasks = () => {
		// Reset filters + display settings, and clear active view.
		filterStore.getState().clearFilters();
		displayStore.getState().fromJSON(
			JSON.stringify({
				grouping: null,
				subGrouping: null,
				ordering: { field: null, direction: "asc" },
			}),
		);
		savedViews.setActiveView(null);
	};

	if (isDetailRoute) {
		return <Outlet />;
	}

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col">
			<PageHeader
				onAddTask={() => setIsModalOpen(true)}
				views={savedViews.views}
				activeViewId={savedViews.activeViewId}
				onViewSelect={handleViewSelect}
				onViewDelete={savedViews.deleteView}
				onStartCreateView={handleStartCreateView}
				onAllTasks={handleAllTasks}
			/>
			{isCreatingView ? (
				<div className="flex min-h-12 shrink-0 flex-col gap-3 border-b bg-background py-3 px-4 lg:px-6">
					{/* Top row: Name, Description, Actions */}
					<div className="flex items-start gap-4">
						<div className="flex flex-1 flex-col gap-2">
							<Input
								placeholder="View name"
								value={viewName}
								onChange={(e) => setViewName(e.target.value)}
								className="h-8 text-sm font-medium"
							/>
							<Textarea
								placeholder="Description (optional)"
								value={viewDescription}
								onChange={(e) => setViewDescription(e.target.value)}
								className="min-h-[60px] resize-none text-sm"
							/>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={handleCancelCreateView}
							>
								Cancel
							</Button>
							<Button
								size="sm"
								onClick={handleSaveView}
								disabled={!viewName.trim()}
							>
								Save view
							</Button>
						</div>
					</div>

					{/* Bottom row: Filters, Match mode, Display */}
					<div className="flex w-full items-center gap-2">
						<div className="flex items-center gap-2 shrink-0">
							<TasksFilterPopover />
						</div>
						<div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
							<TasksFilterChips />
						</div>
						<div className="flex items-center gap-2 shrink-0">
							{hasActiveFilters() && (
								<Button variant="ghost" size="sm" onClick={toggleMatchMode}>
									{matchMode === "any"
										? "Match any filter"
										: "Match all filters"}
								</Button>
							)}
							<TasksDisplaySettings />
						</div>
					</div>
				</div>
			) : (
				<Filters />
			)}
			<div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
				<TasksDataTable columns={taskColumns} />
			</div>
			<TaskModal
				open={isModalOpen}
				onOpenChange={setIsModalOpen}
				mode="create"
			/>
		</div>
	);
}
