import { memo } from "react";
import { AlertTriangle } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateShort } from "@/lib/format-utils";
import { getPriorityIcon, getStatusIcon } from "@/lib/task-utils";
import type { Task, TaskPriority, TaskStatus } from "@/data/types-new";
import {
	EditableTaskAssignee,
	EditableTaskLabels,
	EditableTaskOwner,
	EditableTaskPriority,
	EditableTaskStatus,
} from "./editable-cells";

const statusIconColors: Record<TaskStatus, string> = {
	backlog: "text-muted-foreground/60",
	"to-do": "text-muted-foreground",
	"in-progress": "text-yellow-500",
	"awaiting-review": "text-purple-500",
	done: "text-green-500",
	cancelled: "text-red-500",
};

interface IdentifierCellProps {
	identifier: string;
}

export const IdentifierCell = memo(function IdentifierCell({
	identifier,
}: IdentifierCellProps) {
	return (
		<span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
			{identifier}
		</span>
	);
});

interface PriorityCellProps {
	priority: TaskPriority;
	taskId: Id<"tasks">;
}

export const PriorityCell = memo(function PriorityCell({
	priority,
	taskId,
}: PriorityCellProps) {
	const PriorityIcon = getPriorityIcon(priority);
	return (
		<EditableTaskPriority priority={priority} taskId={taskId}>
			<PriorityIcon className="size-4 text-muted-foreground" />
		</EditableTaskPriority>
	);
});

interface StatusCellProps {
	status: TaskStatus;
	taskId: Id<"tasks">;
}

export const StatusCell = memo(function StatusCell({
	status,
	taskId,
}: StatusCellProps) {
	const StatusIcon = getStatusIcon(status);
	return (
		<EditableTaskStatus status={status} taskId={taskId}>
			<StatusIcon className={statusIconColors[status]} />
		</EditableTaskStatus>
	);
});

interface OwnerCellProps {
	owner: Task["owner"];
	taskId: Id<"tasks">;
}

export const OwnerCell = memo(function OwnerCell({
	owner,
	taskId,
}: OwnerCellProps) {
	return <EditableTaskOwner owner={owner} taskId={taskId} />;
});

interface LabelsCellProps {
	labels: Task["labels"];
	taskId: Id<"tasks">;
}

export const LabelsCell = memo(function LabelsCell({
	labels,
	taskId,
}: LabelsCellProps) {
	return <EditableTaskLabels labels={labels} taskId={taskId} />;
});

interface AssigneeCellProps {
	assignee: Task["assignee"];
	taskId: Id<"tasks">;
}

export const AssigneeCell = memo(function AssigneeCell({
	assignee,
	taskId,
}: AssigneeCellProps) {
	return (
		<EditableTaskAssignee assignee={assignee} taskId={taskId} variant="icon" />
	);
});

interface DueDateCellProps {
	dueDate: string | null;
	createdAt: string;
}

export const DueDateCell = memo(function DueDateCell({
	dueDate,
	createdAt,
}: DueDateCellProps) {
	return (
		<div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
			<span>{createdAt ? formatDateShort(createdAt) : "-"}</span>
			<span>{dueDate ? formatDateShort(dueDate) : "-"}</span>
		</div>
	);
});

function getSubtaskProgress(task: Task): { done: number; total: number } {
	const subtasks = task.subTasks || [];
	const relevant = subtasks.filter((t) => t.status !== "cancelled");
	const done = relevant.filter((t) => t.status === "done").length;
	return { done, total: relevant.length };
}

interface TaskTitleCellProps {
	task: Task;
	hideParentDisplayName?: boolean;
}

export const TaskTitleCell = memo(
	function TaskTitleCell({
		task,
		hideParentDisplayName = false,
	}: TaskTitleCellProps) {
		const { done, total } = getSubtaskProgress(task);
		const showProgress = total > 0;
		const parentDisplayName = hideParentDisplayName
			? null
			: task.parentDisplayName;
		const phaseName = hideParentDisplayName ? null : task.phase?.name;

		return (
			<div className="flex items-center min-w-0">
				<span className="min-w-0 truncate">
					<span className="font-medium text-foreground">{task.title}</span>
					{(parentDisplayName || phaseName) && (
						<span className="ml-1 text-xs text-muted-foreground/80">
							{parentDisplayName && <> · {parentDisplayName}</>}
							{phaseName && <> · {phaseName}</>}
						</span>
					)}
				</span>
				{task.isBlocked && (
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="ml-1.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 whitespace-nowrap">
								<AlertTriangle className="size-3" />
								<span>Blocked</span>
							</span>
						</TooltipTrigger>
						<TooltipContent side="top" sideOffset={6}>
							{task.unresolvedBlockerCount} active blocker
							{task.unresolvedBlockerCount === 1 ? "" : "s"}
						</TooltipContent>
					</Tooltip>
				)}
				{showProgress && (
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="ml-1.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground bg-background whitespace-nowrap">
								<svg className="size-3" viewBox="0 0 16 16" fill="none">
									<title>Subtask progress</title>
									<circle
										cx="8"
										cy="8"
										r="6"
										stroke="currentColor"
										strokeWidth="2"
										strokeOpacity="0.3"
									/>
									<circle
										cx="8"
										cy="8"
										r="6"
										stroke="currentColor"
										strokeWidth="2"
										strokeDasharray={`${(done / total) * 37.7} 37.7`}
										strokeLinecap="round"
										transform="rotate(-90 8 8)"
									/>
								</svg>
								<span>
									{done}/{total}
								</span>
							</span>
						</TooltipTrigger>
						<TooltipContent side="top" sideOffset={6}>
							<div className="space-y-1 text-xs">
								{task.subTasks.map((subtask) => {
									const SubStatusIcon = getStatusIcon(subtask.status);
									return (
										<div
											key={subtask.id}
											className="flex items-center gap-2 max-w-xs"
										>
											<SubStatusIcon className="size-3" />
											<span className="truncate">{subtask.title}</span>
										</div>
									);
								})}
							</div>
						</TooltipContent>
					</Tooltip>
				)}
			</div>
		);
	},
	(prev, next) =>
		prev.task === next.task &&
		prev.hideParentDisplayName === next.hideParentDisplayName,
);
