import { Plus } from "lucide-react";
import { useState } from "react";

import { useTaskColumns } from "@/components/tasks/columns";
import { TasksDataTable } from "@/components/tasks/data-table";
import { TaskListGroup } from "@/components/tasks/task-list-group";
import { useTaskMutations } from "@/hooks/use-convex-data";
import type { Competition, Task } from "@/data/types-new";
import { groupTasksByCompetitionPhase } from "@/lib/task-utils";

interface CompetitionTasksByPhaseProps {
	competition: Competition;
	tasks: Task[];
}

export function CompetitionTasksByPhase({
	competition,
	tasks,
}: CompetitionTasksByPhaseProps) {
	const columns = useTaskColumns({ hideParentDisplayName: true });
	const { addTask } = useTaskMutations();
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
		() => new Set(),
	);

	if (tasks.length === 0) {
		return (
			<section className="space-y-2">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-medium text-muted-foreground">
						Tasks by phase
					</h2>
				</div>
				<p className="text-sm text-muted-foreground">
					No tasks linked to this competition yet.
				</p>
			</section>
		);
	}

	const groups = groupTasksByCompetitionPhase(tasks, competition);

	const toggleGroup = (key: string) => {
		setCollapsedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	};

	const handleAddTaskForGroup = (_groupKey: string, phaseId?: string) => {
		const phase = phaseId
			? (competition.phases.find((p) => p.id === phaseId) ?? null)
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
		});
	};

	return (
		<section className="min-w-0 space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-sm font-medium text-muted-foreground">
					Tasks by phase
				</h2>
				<span className="text-xs text-muted-foreground">
					{tasks.length} task{tasks.length === 1 ? "" : "s"}
				</span>
			</div>

			<div className="space-y-5 sm:space-y-6">
				{groups.map((group) => {
					const groupKey = group.phase?.id ?? "unassigned";
					const doneCount = group.tasks.filter(
						(task) => task.status === "done",
					).length;
					const inProgressCount = group.tasks.filter(
						(task) => task.status === "in-progress",
					).length;
					const isCollapsed = collapsedGroups.has(groupKey);

					return (
						<TaskListGroup
							key={groupKey}
							title={group.phase ? group.phase.name : "No phase"}
							countLabel={`${group.tasks.length} task${group.tasks.length === 1 ? "" : "s"}`}
							isCollapsed={isCollapsed}
							onToggle={() => toggleGroup(groupKey)}
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
							<div className="min-w-0 w-full max-w-full overflow-x-auto rounded-md border border-border [touch-action:pan-x]">
								<div className="min-w-[760px]">
									<TasksDataTable
										columns={columns}
										tasks={group.tasks}
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
							</div>
						</TaskListGroup>
					);
				})}
			</div>
		</section>
	);
}
