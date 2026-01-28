import { Plus } from "lucide-react";
import { useState } from "react";

import { taskColumns } from "@/components/tasks/columns";
import { TasksDataTable } from "@/components/tasks/data-table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useDataV2 } from "@/data/data-store-v2";
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
	const addTask = useDataV2((state) => state.addTask);
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
		const parent: Task["parent"] =
			phaseId != null
				? { type: "phase", linkedId: phaseId }
				: { type: "competition", linkedId: competition.id };

		addTask({
			parent,
			title: "New task",
			description: "",
			owner: null,
			assignee: null,
			phase: phaseId
				? (competition.phases.find((p) => p.id === phaseId) ?? null)
				: null,
			status: "to-do",
			priority: "medium",
			dueDate: null,
			requiredApprovalBy: [],
			approvedBy: [],
			labels: [],
			resources: [],
		});
	};

	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-medium text-muted-foreground">
					Tasks by phase
				</h2>
				<span className="text-xs text-muted-foreground">
					{tasks.length} task{tasks.length === 1 ? "" : "s"}
				</span>
			</div>

			<div className="space-y-6">
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
						<div
							key={groupKey}
							className="space-y-2 rounded-lg border border-border bg-background/40 p-3"
						>
							<div className="flex items-center justify-between">
								<button
									type="button"
									className="flex items-center gap-2"
									onClick={() => toggleGroup(groupKey)}
								>
									<span className="text-sm font-medium">
										{group.phase ? group.phase.name : "No phase"}
									</span>
									<Badge
										variant="outline"
										className="h-5 border-border bg-background text-xs font-normal"
									>
										{group.tasks.length} task
										{group.tasks.length === 1 ? "" : "s"}
									</Badge>
								</button>
								<div className="flex items-center gap-3 text-[11px] text-muted-foreground">
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
										className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/60"
										onClick={() =>
											handleAddTaskForGroup(groupKey, group.phase?.id)
										}
									>
										<Plus className="size-3" />
										Add task
									</button>
								</div>
							</div>

							{!isCollapsed && (
								<>
									<Separator />
									<div className="rounded-md border border-border">
										<TasksDataTable columns={taskColumns} tasks={group.tasks} />
									</div>
								</>
							)}
						</div>
					);
				})}
			</div>
		</section>
	);
}
