import { memo } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDateShort } from "@/lib/format-utils";
import {
	getPriorityIcon,
	getStatusIcon,
	statusIconColors,
} from "@/lib/task-utils";
import type { Task, TaskPriority, TaskStatus } from "@/data/types-new";
import {
	EditableTaskAssignee,
	EditableTaskLabels,
	EditableTaskOwner,
	EditableTaskPriority,
	EditableTaskStatus,
} from "./editable-cells";
import { TaskIndicators } from "./task-indicators";

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
	task: Task;
}

export const StatusCell = memo(function StatusCell({
	status,
	taskId,
	task,
}: StatusCellProps) {
	const StatusIcon = getStatusIcon(status);
	return (
		<EditableTaskStatus status={status} taskId={taskId} task={task}>
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
	return <EditableTaskOwner owner={owner} taskId={taskId} variant="icon" />;
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

interface TaskTitleCellProps {
	task: Task;
	parentDisplayMode?: "full" | "none" | "task-only";
}

export type TaskParentDisplayMode = NonNullable<
	TaskTitleCellProps["parentDisplayMode"]
>;

export const TaskTitleCell = memo(
	function TaskTitleCell({
		task,
		parentDisplayMode = "full",
	}: TaskTitleCellProps) {
		let parentDisplayName: string | null = null;
		let contextName: string | null = null;

		if (parentDisplayMode === "full") {
			parentDisplayName = task.parentDisplayName;
			contextName =
				task.parent?.type === "task"
					? (task.competitionDisplayName ?? task.phase?.name ?? null)
					: (task.phase?.name ?? null);
		} else if (parentDisplayMode === "task-only") {
			parentDisplayName =
				task.parent?.type === "task" ? task.parentDisplayName : null;
		}

		return (
			<div className="flex items-center min-w-0">
				<span className="min-w-0 truncate">
					<span className="font-medium text-foreground">{task.title}</span>
					{(parentDisplayName || contextName) && (
						<span className="ml-1 text-xs text-muted-foreground/80">
							{parentDisplayName && <> · {parentDisplayName}</>}
							{contextName && <> · {contextName}</>}
						</span>
					)}
				</span>
				<TaskIndicators task={task} />
			</div>
		);
	},
	(prev, next) =>
		prev.task === next.task &&
		prev.parentDisplayMode === next.parentDisplayMode,
);
