import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Task } from "@/data/types-new";
import { getStatusIcon } from "@/lib/task-utils";

const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 6;

function getSubtaskProgress(task: Task): { done: number; total: number } {
	const subtasks = task.subTasks || [];
	const relevant = subtasks.filter((t) => t.status !== "cancelled");
	const done = relevant.filter((t) => t.status === "done").length;
	return { done, total: relevant.length };
}

interface TaskIndicatorsProps {
	task: Task;
	blockedClassName?: string;
	progressClassName?: string;
	blockedIcon?: ReactNode;
	tooltipSide?: React.ComponentProps<typeof TooltipContent>["side"];
	tooltipSideOffset?: number;
}

export function TaskIndicators({
	task,
	blockedClassName = "ml-1.5",
	progressClassName = "ml-1.5 shrink-0 gap-1",
	blockedIcon = <AlertTriangle />,
	tooltipSide = "top",
	tooltipSideOffset = 6,
}: TaskIndicatorsProps) {
	const { done, total } = getSubtaskProgress(task);
	const showProgress = total > 0;

	if (!task.isBlocked && !showProgress) {
		return null;
	}

	return (
		<>
			{task.isBlocked && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge variant="warning-outline" className={blockedClassName}>
							{blockedIcon}
							<span>Blocked</span>
						</Badge>
					</TooltipTrigger>
					<TooltipContent side={tooltipSide} sideOffset={tooltipSideOffset}>
						{task.unresolvedBlockerCount} active blocker
						{task.unresolvedBlockerCount === 1 ? "" : "s"}
					</TooltipContent>
				</Tooltip>
			)}
			{showProgress && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge variant="outline" className={progressClassName}>
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
									strokeDasharray={`${(done / total) * CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`}
									strokeLinecap="round"
									transform="rotate(-90 8 8)"
								/>
							</svg>
							<span>
								{done}/{total}
							</span>
						</Badge>
					</TooltipTrigger>
					<TooltipContent side={tooltipSide} sideOffset={tooltipSideOffset}>
						<div className="space-y-1 text-xs">
							{task.subTasks.map((subtask) => {
								const SubStatusIcon = getStatusIcon(subtask.status);
								return (
									<div
										key={subtask.id}
										className="flex max-w-xs items-center gap-2"
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
		</>
	);
}
