import {
	Bell,
	CalendarClock,
	CircleCheck,
	Edit3,
	Flag,
	Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { DetailSummaryStat } from "@/components/shared/detail-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Task } from "@/data/types-new";
import { priorityLabels, statusLabels } from "@/lib/task-constants";

function getDueDateInfo(task: Task) {
	if (!task.dueDate) {
		return {
			label: "No due date",
			tone: "neutral" as const,
			meta: undefined,
		};
	}

	const dueDate = new Date(task.dueDate);
	const isOverdue = task.status !== "done" && dueDate.getTime() < Date.now();

	return {
		label: dueDate.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		}),
		tone: isOverdue ? ("danger" as const) : ("neutral" as const),
		meta: isOverdue ? "Overdue" : undefined,
	};
}

export function TaskOverviewPanel({
	task,
	isSubscribed,
	canEdit,
	canDelete,
	onToggleSubscription,
	onRemindMe,
	onEditDetails,
	onDelete,
}: {
	task: Task;
	isSubscribed: boolean;
	canEdit: boolean;
	canDelete: boolean;
	onToggleSubscription: () => void;
	onRemindMe: () => void;
	onEditDetails: () => void;
	onDelete: () => void;
}) {
	const dueDateInfo = getDueDateInfo(task);

	return (
		<section className="overflow-hidden rounded-lg border bg-card">
			<div className="border-b bg-muted/20 px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
				<div className="flex flex-col gap-4">
					<div className="flex items-start gap-4">
						<div className="flex size-16 shrink-0 items-center justify-center rounded-lg border bg-background text-sm font-semibold text-foreground sm:size-20 sm:text-base">
							{task.identifier}
						</div>
						<div className="min-w-0 flex-1">
							<h1 className="min-w-0 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
								{task.title}
							</h1>
							{task.description ? (
								<div className="prose prose-sm mt-2 max-w-2xl text-muted-foreground dark:prose-invert sm:prose-base">
									<ReactMarkdown rehypePlugins={[rehypeSanitize]}>
										{task.description}
									</ReactMarkdown>
								</div>
							) : (
								<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
									Add context so people can understand the task without opening
									other pages.
								</p>
							)}
						</div>
					</div>

					<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
							<DetailSummaryStat
								label="Status"
								value={statusLabels[task.status]}
								tone={task.status === "done" ? "positive" : "neutral"}
							/>
							<DetailSummaryStat
								label="Priority"
								value={priorityLabels[task.priority]}
								tone={task.priority === "urgent" ? "danger" : "neutral"}
							/>
							<DetailSummaryStat
								label="Due"
								value={dueDateInfo.label}
								tone={dueDateInfo.tone}
							/>
							<DetailSummaryStat
								label="Assignee"
								value={task.assignee?.name ?? "Unassigned"}
							/>
						</div>

						<div className="rounded-lg border bg-card p-3">
							<div className="flex flex-wrap gap-2">
								<Badge
									variant="outline"
									className="h-6 gap-1 border-border bg-background text-[11px] font-normal"
								>
									<CircleCheck className="size-3.5" />
									{statusLabels[task.status]}
								</Badge>
								<Badge
									variant="outline"
									className="h-6 gap-1 border-border bg-background text-[11px] font-normal"
								>
									<Flag className="size-3.5" />
									{priorityLabels[task.priority]}
								</Badge>
								<Badge
									variant="outline"
									className="h-6 gap-1 border-border bg-background text-[11px] font-normal"
								>
									<CalendarClock className="size-3.5" />
									{dueDateInfo.label}
								</Badge>
								{task.labels.map((label) => (
									<Badge
										key={label.id}
										variant="outline"
										className="h-6 gap-1 border-border bg-background text-[11px] font-normal"
									>
										<span
											className="size-2 rounded-full"
											style={{ backgroundColor: label.color }}
										/>
										{label.name}
									</Badge>
								))}
							</div>
						</div>
					</div>

					<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
						<Button
							size="lg"
							onClick={onToggleSubscription}
							variant={isSubscribed ? "secondary" : "default"}
							className="min-h-11 w-full px-5 sm:w-auto"
						>
							<Bell className="size-4" />
							{isSubscribed ? "Watching task" : "Watch task"}
						</Button>
						<Button
							variant="outline"
							size="lg"
							onClick={onRemindMe}
							className="min-h-11 w-full px-5 sm:w-auto"
						>
							<Bell className="size-4" />
							Remind me
						</Button>
						{canEdit ? (
							<Button
								variant="outline"
								size="lg"
								onClick={onEditDetails}
								className="min-h-11 w-full px-5 sm:w-auto"
							>
								<Edit3 className="size-4" />
								Edit title and description
							</Button>
						) : null}
						{canDelete ? (
							<Button
								variant="destructive"
								size="lg"
								onClick={onDelete}
								className="min-h-11 w-full px-5 sm:ml-auto sm:w-auto"
							>
								<Trash2 className="size-4" />
								Delete task
							</Button>
						) : null}
					</div>
				</div>
			</div>
		</section>
	);
}
