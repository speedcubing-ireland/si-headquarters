import { createFileRoute } from "@tanstack/react-router";
import { ListTodo, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SharedPageHeader } from "@/components/shared/page-header";
import { taskColumns } from "@/components/tasks/columns";
import { TasksDataTable } from "@/components/tasks/data-table";
import { TasksDisplaySettings } from "@/components/tasks/display-settings";
import { TasksFilterChips } from "@/components/tasks/filter-chips";
import { TasksFilterPopover } from "@/components/tasks/filter-popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDataV2 } from "@/data/data-store-v2";
import type { Task, Team } from "@/data/types-new";
import { useTasksDisplaySettingsStore } from "@/store/tasks-display-settings-store";
import { useTasksFilterStore } from "@/store/tasks-filter-store";

type TriageFilter = "all" | "unassigned" | "assigned";

export const Route = createFileRoute("/teams/$teamId")({
	component: RouteComponent,
});

function PageHeader({
	team,
	onAllTasks,
}: {
	team: Team;
	onAllTasks: () => void;
}) {
	return (
		<SharedPageHeader
			primaryIcon={Users}
			primaryLabel={`Team: ${team.name}`}
			secondaryLabel="Triage tasks owned by this team"
			addIcon={ListTodo}
			addLabel="All tasks"
			onAdd={onAllTasks}
			onPrimaryClick={onAllTasks}
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

function useTeamOwnedTasks(teamId: string): Task[] {
	const allTasks = useDataV2((state) => state.tasks);

	return useMemo(
		() =>
			allTasks.filter(
				(task) =>
					task.owner && "members" in task.owner && task.owner.id === teamId,
			),
		[allTasks, teamId],
	);
}

function RouteComponent() {
	const { teamId } = Route.useParams();
	const teams = useDataV2((state) => state.teams);
	const team = teams.find((t) => t.id === teamId);
	const [triageFilter, setTriageFilter] = useState<TriageFilter>("all");

	const filterStore = useTasksFilterStore;
	const displayStore = useTasksDisplaySettingsStore;

	const ownedTasks = useTeamOwnedTasks(teamId);

	const triagedTasks = useMemo(() => {
		if (triageFilter === "unassigned") {
			return ownedTasks.filter((task) => !task.assignee);
		}
		if (triageFilter === "assigned") {
			return ownedTasks.filter((task) => task.assignee);
		}
		return ownedTasks;
	}, [ownedTasks, triageFilter]);

	// Default display: group by status for readability, no extra filters by default.
	useEffect(() => {
		const state = filterStore.getState();
		if (!state.hasActiveFilters()) {
			state.clearFilters();
		}
		displayStore.getState().fromJSON(
			JSON.stringify({
				grouping: "status",
				subGrouping: null,
				ordering: { field: null, direction: "asc" },
			}),
		);
	}, []);

	const handleAllTasks = () => {
		filterStore.getState().clearFilters();
		displayStore.getState().fromJSON(
			JSON.stringify({
				grouping: null,
				subGrouping: null,
				ordering: { field: null, direction: "asc" },
			}),
		);
	};

	if (!team) {
		return (
			<div className="flex h-full flex-1 items-center justify-center p-4">
				<Card className="max-w-md w-full border-dashed">
					<CardHeader>
						<CardTitle className="text-sm font-medium">
							Team not found
						</CardTitle>
					</CardHeader>
					<CardContent className="text-sm text-muted-foreground">
						The team you&apos;re looking for doesn&apos;t exist. It may have
						been renamed or removed.
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col">
			<PageHeader team={team} onAllTasks={handleAllTasks} />

			<div className="flex flex-col">
				<div className="flex items-center justify-between border-b px-4 lg:px-6 py-2">
					<div className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground">Triage view</span>
						<Separator orientation="vertical" className="h-4" />
						<div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5 text-xs">
							<Button
								variant={triageFilter === "all" ? "secondary" : "ghost"}
								size="xs"
								className="h-6 px-2 text-xs"
								onClick={() => setTriageFilter("all")}
							>
								All
							</Button>
							<Button
								variant={triageFilter === "unassigned" ? "secondary" : "ghost"}
								size="xs"
								className="h-6 px-2 text-xs"
								onClick={() => setTriageFilter("unassigned")}
							>
								Unassigned
							</Button>
							<Button
								variant={triageFilter === "assigned" ? "secondary" : "ghost"}
								size="xs"
								className="h-6 px-2 text-xs"
								onClick={() => setTriageFilter("assigned")}
							>
								Assigned
							</Button>
						</div>
					</div>
					<span className="text-xs text-muted-foreground">
						{triagedTasks.length} task
						{triagedTasks.length === 1 ? "" : "s"}
					</span>
				</div>

				<Filters />
			</div>

			<div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 lg:px-6">
				<TasksDataTable columns={taskColumns} tasks={triagedTasks} />
			</div>
		</div>
	);
}
