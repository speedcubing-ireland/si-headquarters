import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Eye } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Id } from "@/convex/_generated/dataModel";
import type { Task } from "@/data/types-new";
import {
	getPriorityIcon,
	getStatusIcon,
	statusIconColors,
} from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import {
	EditableTaskPriority,
	EditableTaskStatus,
} from "@/components/tasks/editable-cells";
import { TaskIndicators } from "@/components/tasks/task-indicators";

interface CompactTaskRowProps {
	task: Task;
	onMarkDone?: (taskId: Id<"tasks">) => void;
	showViewAction?: boolean;
}

export const CompactTaskRow = memo(function CompactTaskRow({
	task,
	onMarkDone,
	showViewAction,
}: CompactTaskRowProps) {
	const parentDisplayName = task.parentDisplayName;
	const contextName =
		task.parent?.type === "task"
			? (task.competitionDisplayName ?? task.phase?.name ?? null)
			: (task.phase?.name ?? null);

	return (
		<Link
			to="/tasks/$id"
			params={{ id: task.id }}
			className="group flex min-w-0 items-center border-b border-border/50 px-1 py-2.5 text-sm transition-colors hover:bg-muted/30 h-11 sm:h-10"
		>
			<div className="flex shrink-0 items-center">
				<EditableTaskStatus status={task.status} taskId={task.id} task={task}>
					<div className="flex size-6 items-center justify-center">
						{(() => {
							const StatusIcon = getStatusIcon(task.status);
							return (
								<StatusIcon
									className={cn("size-4", statusIconColors[task.status])}
								/>
							);
						})()}
					</div>
				</EditableTaskStatus>
			</div>

			<div className="hidden @[24rem]:flex shrink-0 items-center">
				<EditableTaskPriority priority={task.priority} taskId={task.id}>
					<div className="flex size-6 items-center justify-center">
						{(() => {
							const PriorityIcon = getPriorityIcon(task.priority);
							return <PriorityIcon className="size-4 text-muted-foreground" />;
						})()}
					</div>
				</EditableTaskPriority>
			</div>

			<div className="min-w-0 flex-1 px-1">
				<div className="flex min-w-0 items-center gap-1">
					<span className="truncate font-medium text-foreground">
						{task.title}
					</span>
					{(parentDisplayName || contextName) && (
						<span className="min-w-0 hidden shrink truncate text-xs text-muted-foreground/80 @[28rem]:inline">
							{parentDisplayName && <>· {parentDisplayName}</>}
							{parentDisplayName && contextName && <> </>}
							{contextName && <>· {contextName}</>}
						</span>
					)}
					<TaskIndicators
						task={task}
						blockedClassName="ml-1.5 hidden shrink-0 @[20rem]:flex"
						progressClassName="ml-1.5 hidden shrink-0 gap-1 @[20rem]:flex"
						blockedIcon={<CheckCircle2 className="size-3" />}
					/>
				</div>
			</div>

			<div className="shrink-0 px-1 text-right">
				{showViewAction ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="inline-flex size-7 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-muted/50 group-hover:opacity-100 focus-visible:opacity-100">
								<Eye className="size-4 text-muted-foreground" />
							</span>
						</TooltipTrigger>
						<TooltipContent side="left" sideOffset={4}>
							View task
						</TooltipContent>
					</Tooltip>
				) : onMarkDone ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									onMarkDone(task.id);
								}}
								className="inline-flex size-7 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-muted/50 group-hover:opacity-100 focus-visible:opacity-100"
							>
								<CheckCircle2 className="size-4 text-muted-foreground hover:text-success" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="left" sideOffset={4}>
							Mark as done
						</TooltipContent>
					</Tooltip>
				) : null}
			</div>
		</Link>
	);
});
