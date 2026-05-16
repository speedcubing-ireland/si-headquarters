import { CalendarClock, Flag, Hash, Tag, UserRound, Users } from "lucide-react";
import { DetailInfoRow, DetailSection } from "@/components/shared/detail-page";
import {
	EditableTaskAssignee,
	EditableTaskLabels,
	EditableTaskOwner,
	EditableTaskPriority,
	EditableTaskStatus,
} from "@/components/tasks/editable-cells";
import { TaskDueDateControl } from "@/components/tasks/task-due-date-control";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/data/types-new";
import { formatDate } from "@/lib/format-utils";
import { priorityLabels, statusLabels } from "@/lib/task-constants";
import { getPriorityIcon, getStatusIcon } from "@/lib/task-utils";

export function TaskInfoPanel({ task }: { task: Task }) {
	const StatusIcon = getStatusIcon(task.status);
	const PriorityIcon = getPriorityIcon(task.priority);

	return (
		<DetailSection title="Details">
			<div className="grid gap-3 sm:grid-cols-2">
				<DetailInfoRow label="Status" icon={<Flag className="size-3.5" />}>
					<EditableTaskStatus status={task.status} taskId={task.id} task={task}>
						<div className="flex min-w-0 items-center gap-2 text-sm font-medium">
							<StatusIcon className="size-4" />
							<span>{statusLabels[task.status]}</span>
						</div>
					</EditableTaskStatus>
				</DetailInfoRow>
				<DetailInfoRow label="Priority" icon={<Flag className="size-3.5" />}>
					<EditableTaskPriority priority={task.priority} taskId={task.id}>
						<div className="flex min-w-0 items-center gap-2 text-sm font-medium capitalize">
							<PriorityIcon className="size-4" />
							<span>{priorityLabels[task.priority]}</span>
						</div>
					</EditableTaskPriority>
				</DetailInfoRow>
				<DetailInfoRow
					label="Assignee"
					icon={<UserRound className="size-3.5" />}
				>
					<EditableTaskAssignee assignee={task.assignee} taskId={task.id} />
				</DetailInfoRow>
				<DetailInfoRow label="Owner" icon={<Users className="size-3.5" />}>
					<EditableTaskOwner owner={task.owner} taskId={task.id} />
				</DetailInfoRow>
				<DetailInfoRow
					label="Due date"
					icon={<CalendarClock className="size-3.5" />}
				>
					<TaskDueDateControl task={task} />
				</DetailInfoRow>
				<DetailInfoRow label="Labels" icon={<Tag className="size-3.5" />}>
					<EditableTaskLabels labels={task.labels} taskId={task.id} wrap />
				</DetailInfoRow>
				<DetailInfoRow
					label="Created"
					icon={<CalendarClock className="size-3.5" />}
				>
					<div className="text-sm font-medium">
						{formatDate(task.createdAt)}
					</div>
				</DetailInfoRow>
				<DetailInfoRow
					label="Updated"
					icon={<CalendarClock className="size-3.5" />}
				>
					<div className="text-sm font-medium">
						{formatDate(task.updatedAt)}
					</div>
				</DetailInfoRow>
				<DetailInfoRow label="Identifier" icon={<Hash className="size-3.5" />}>
					<Badge variant="outline" className="font-mono">
						{task.identifier}
					</Badge>
				</DetailInfoRow>
			</div>
		</DetailSection>
	);
}
