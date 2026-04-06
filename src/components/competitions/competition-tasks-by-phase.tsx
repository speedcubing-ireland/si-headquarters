import { Plus, SquareDashedKanban } from "lucide-react";
import { useState } from "react";

import { useTaskColumns } from "@/components/tasks/columns";
import { TasksDataTable } from "@/components/tasks/data-table";
import { TaskListGroup } from "@/components/tasks/task-list-group";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTaskMutations } from "@/hooks/use-convex-data";
import type { Competition, Task } from "@/data/types-new";
import {
	buildCompetitionPhaseTaskView,
	countVisibleTasks,
	isArchivePhaseName,
	togglePhaseCollapsedState,
} from "@/lib/competition-phase-task-view";
import {
	groupTasksByCompetitionPhase,
	sortTasksByStatusThenPriority,
} from "@/lib/task-utils";
import { onMutationError } from "@/lib/utils";

interface CompetitionTasksByPhaseProps {
	competition: Competition;
	tasks: Task[];
}

export function CompetitionTasksByPhase({
	competition,
	tasks,
}: CompetitionTasksByPhaseProps) {
	const columns = useTaskColumns({ parentDisplayMode: "task-only" });
	const { addTask } = useTaskMutations();
	const [hideFinishedTasks, setHideFinishedTasks] = useState(false);
	const [collapseCompletedPhases, setCollapseCompletedPhases] = useState(true);
	const [showSubtasks, setShowSubtasks] = useState(false);
	const [manuallyCollapsedPhaseKeys, setManuallyCollapsedPhaseKeys] = useState<
		Set<string>
	>(() => new Set());
	const [
		manuallyExpandedCompletedPhaseKeys,
		setManuallyExpandedCompletedPhaseKeys,
	] = useState<Set<string>>(() => new Set());

	const phasesWithoutArchive = competition.phases.filter(
		(phase: Competition["phases"][number]) => !isArchivePhaseName(phase.name),
	);
	const groups = groupTasksByCompetitionPhase(tasks, {
		...competition,
		phases: phasesWithoutArchive,
	});
	const groupViews = buildCompetitionPhaseTaskView(groups, {
		hideFinishedTasks,
		collapseCompletedPhases,
		showSubtasks,
		manuallyCollapsedPhaseKeys,
		manuallyExpandedCompletedPhaseKeys,
	});
	const visibleTaskCount = countVisibleTasks(groupViews);

	const toggleGroup = (
		key: string,
		phaseCompleted: boolean,
		phaseName: string | null,
		phaseIsEmpty: boolean,
	) => {
		const next = togglePhaseCollapsedState({
			groupKey: key,
			phaseCompleted,
			phaseName,
			phaseIsEmpty,
			collapseCompletedPhases,
			manuallyCollapsedPhaseKeys,
			manuallyExpandedCompletedPhaseKeys,
		});
		setManuallyCollapsedPhaseKeys(next.manuallyCollapsedPhaseKeys);
		setManuallyExpandedCompletedPhaseKeys(
			next.manuallyExpandedCompletedPhaseKeys,
		);
	};

	const handleAddTaskForGroup = (groupKey: string, phaseId?: string) => {
		setManuallyCollapsedPhaseKeys((prev) => {
			const next = new Set(prev);
			next.delete(groupKey);
			return next;
		});
		setManuallyExpandedCompletedPhaseKeys((prev) => {
			const next = new Set(prev);
			next.add(groupKey);
			return next;
		});

		const phase = phaseId
			? (competition.phases.find((p: Competition["phases"][number]) => p.id === phaseId) ?? null)
			: null;
		void addTask({
			parent: { type: "competition", linkedId: competition.id },
			title: "New task",
			description: "",
			owner: null,
			assignee: null,
			phase,
			status: "to-do",
			priority: "medium",
			dueDate: null,
			labels: [],
		}).catch(onMutationError);
	};

	return (
		<section className="min-w-0 space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-sm font-medium text-muted-foreground">
					Tasks by phase
				</h2>
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">
						{visibleTaskCount} shown · {tasks.length} total
					</span>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								<SquareDashedKanban className="size-4" />
								Display
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuLabel>Task visibility</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuCheckboxItem
								checked={hideFinishedTasks}
								onCheckedChange={(checked) =>
									setHideFinishedTasks(checked === true)
								}
							>
								Hide finished tasks
							</DropdownMenuCheckboxItem>
							<DropdownMenuCheckboxItem
								checked={collapseCompletedPhases}
								onCheckedChange={(checked) =>
									setCollapseCompletedPhases(checked === true)
								}
							>
								Collapse completed phases
							</DropdownMenuCheckboxItem>
							<DropdownMenuCheckboxItem
								checked={showSubtasks}
								onCheckedChange={(checked) => setShowSubtasks(checked === true)}
							>
								Show subtasks
							</DropdownMenuCheckboxItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{groupViews.length === 0 ? (
				<p className="text-sm text-muted-foreground">No phases configured.</p>
			) : (
				<div className="space-y-5 sm:space-y-6">
					{groupViews.map((groupView) => {
						const { group, groupKey, phaseCompleted, phaseIsEmpty } = groupView;
						const sortedTasks = sortTasksByStatusThenPriority(
							groupView.visibleTasks,
						);
						const doneCount = sortedTasks.filter(
							(task) => task.status === "done",
						).length;
						const inProgressCount = sortedTasks.filter(
							(task) => task.status === "in-progress",
						).length;
						const isCollapsed = groupView.isCollapsed;

						return (
							<TaskListGroup
								key={groupKey}
								title={group.phase ? group.phase.name : "No phase"}
								countLabel={`${sortedTasks.length} task${sortedTasks.length === 1 ? "" : "s"}`}
								isCollapsed={isCollapsed}
								onToggle={() =>
									toggleGroup(
										groupKey,
										phaseCompleted,
										group.phase?.name ?? null,
										phaseIsEmpty,
									)
								}
								headerMeta={
									<div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
										<span>
											<span className="font-medium text-foreground">
												{doneCount}
											</span>{" "}
											done
										</span>
										<span>
											<span className="font-medium text-foreground">
												{inProgressCount}
											</span>{" "}
											in progress
										</span>
										<button
											type="button"
											className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/60"
											onClick={() =>
												handleAddTaskForGroup(groupKey, group.phase?.id)
											}
										>
											<Plus className="size-3" />
											Add task
										</button>
									</div>
								}
							>
								<div className="min-w-0 w-full max-w-full overflow-hidden rounded-md border border-border">
									<TasksDataTable
										columns={columns}
										tasks={sortedTasks}
										filters={{
											status: [],
											priority: [],
											assignee: [],
											labels: [],
											owner: [],
											parentType: [],
										}}
										matchMode="all"
										grouping={null}
										subGrouping={null}
										ordering={{ field: null, direction: "asc" }}
										onOrderingChange={() => {}}
									/>
								</div>
							</TaskListGroup>
						);
					})}
				</div>
			)}
		</section>
	);
}
