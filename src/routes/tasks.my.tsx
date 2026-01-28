import { createFileRoute } from "@tanstack/react-router";
import { ListTodo, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SharedPageHeader } from "@/components/shared/page-header";
import { taskColumns } from "@/components/tasks/columns";
import { TasksDataTable } from "@/components/tasks/data-table";
import { TasksDisplaySettings } from "@/components/tasks/display-settings";
import { TasksFilterChips } from "@/components/tasks/filter-chips";
import { TasksFilterPopover } from "@/components/tasks/filter-popover";
import { TaskModal } from "@/components/tasks/task-modal";
import { Button } from "@/components/ui/button";
import { useDataV2 } from "@/data/data-store-v2";
import type { Task } from "@/data/types-new";
import { useTasksDisplaySettingsStore } from "@/store/tasks-display-settings-store";
import { useTasksFilterStore } from "@/store/tasks-filter-store";

export const Route = createFileRoute("/tasks/my")({
	component: RouteComponent,
});

function PageHeader({ onAddTask }: { onAddTask: () => void }) {
	return (
		<SharedPageHeader
			primaryIcon={ListTodo}
			primaryLabel="My tasks"
			addIcon={Plus}
			addLabel="Add task"
			onAdd={onAddTask}
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

function useCurrentUserTasks(): Task[] {
	const users = useDataV2((state) => state.users);
	const allTasks = useDataV2((state) => state.tasks);
	const currentUser = users[0];

	const mine = useMemo(
		() => allTasks.filter((task) => task.assignee?.id === currentUser?.id),
		[allTasks, currentUser?.id],
	);

	return mine;
}

function RouteComponent() {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const myTasks = useCurrentUserTasks();

	// Keyboard shortcut: C to create a new task scoped to "My tasks"
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
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

	const filterStore = useTasksFilterStore;
	const displayStore = useTasksDisplaySettingsStore;

	// Ensure default filters show only current user's tasks when first landing here.
	useEffect(() => {
		const state = filterStore.getState();
		if (!state.hasActiveFilters()) {
			const current = useDataV2.getState().users[0];
			if (current) {
				state.setFilter("assignee", [current.id]);
			}
		}
		// Use a simple grouping for readability
		displayStore.getState().fromJSON(
			JSON.stringify({
				grouping: "status",
				subGrouping: null,
				ordering: { field: null, direction: "asc" },
			}),
		);
	}, []);

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col">
			<PageHeader onAddTask={() => setIsModalOpen(true)} />
			<Filters />
			<div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 lg:px-6">
				<TasksDataTable columns={taskColumns} tasks={myTasks} />
			</div>
			<TaskModal
				open={isModalOpen}
				onOpenChange={setIsModalOpen}
				mode="create"
			/>
		</div>
	);
}
