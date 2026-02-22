import { useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { CompactTaskRow } from "@/components/tasks/compact-task-row";
import { DashboardWidgetCard } from "@/components/dashboard/dashboard-widget-card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Task, TaskPriority } from "@/data/types-new";
import { useTasks, useTaskMutations } from "@/hooks/use-convex-data";
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result";
import { isUserRequiredApprover } from "@/lib/task-utils";
import { cn, onMutationError } from "@/lib/utils";

const PRIORITY_ORDER: Record<TaskPriority, number> = {
	urgent: 0,
	high: 1,
	medium: 2,
	low: 3,
};

const MAX_ITEMS = 12;

export type FocusGroup =
	| "overdue"
	| "blocking"
	| "needs-review"
	| "due-this-week"
	| "in-progress"
	| "to-do";

const GROUP_CONFIG: Record<FocusGroup, { label: string; borderClass: string }> =
	{
		overdue: { label: "Overdue", borderClass: "border-l-red-500" },
		blocking: { label: "Blocking Others", borderClass: "border-l-amber-500" },
		"needs-review": {
			label: "Needs Your Review",
			borderClass: "border-l-orange-500",
		},
		"due-this-week": {
			label: "Due This Week",
			borderClass: "border-l-yellow-500",
		},
		"in-progress": { label: "In Progress", borderClass: "border-l-blue-500" },
		"to-do": { label: "To Do", borderClass: "" },
	};

const GROUP_ORDER: FocusGroup[] = [
	"overdue",
	"blocking",
	"needs-review",
	"due-this-week",
	"in-progress",
	"to-do",
];

function isTaskPendingUserReview(task: Task, userId: string): boolean {
	return (
		task.status === "awaiting-review" &&
		isUserRequiredApprover(task, userId) &&
		!task.approvedBy.some((u) => u.id === userId)
	);
}

export function classifyTask(
	task: Task,
	userId: string,
	today: Date,
	weekFromNow: Date,
): FocusGroup | null {
	const isDone = task.status === "done" || task.status === "cancelled";
	if (isDone) return null;

	const isAssignedToMe = task.assignee?.id === userId;

	if (isAssignedToMe && task.dueDate) {
		const due = new Date(task.dueDate);
		if (due < today) return "overdue";
	}

	if (isAssignedToMe) {
		const unresolvedBlocks = task.blocks.filter(
			(b) => b.status !== "done" && b.status !== "cancelled",
		);
		if (unresolvedBlocks.length > 0) return "blocking";
	}

	if (isTaskPendingUserReview(task, userId)) {
		return "needs-review";
	}

	if (!isAssignedToMe) return null;

	if (task.dueDate) {
		const due = new Date(task.dueDate);
		if (due <= weekFromNow) return "due-this-week";
	}

	if (task.status === "in-progress") return "in-progress";

	if (task.status === "to-do") return "to-do";

	return null;
}

export function sortTasks(a: Task, b: Task): number {
	const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
	if (priorityDiff !== 0) return priorityDiff;

	if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
	if (a.dueDate) return -1;
	if (b.dueDate) return 1;

	return 0;
}

export interface GroupedTasks {
	group: FocusGroup;
	tasks: Task[];
}

export function buildFocusGroups(
	tasks: Task[],
	userId: string,
): GroupedTasks[] {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const weekFromNow = new Date(today);
	weekFromNow.setDate(today.getDate() + 7);

	const groups = new Map<FocusGroup, Task[]>();

	for (const task of tasks) {
		const group = classifyTask(task, userId, today, weekFromNow);
		if (!group) continue;

		const list = groups.get(group);
		if (list) {
			list.push(task);
		} else {
			groups.set(group, [task]);
		}
	}

	for (const list of groups.values()) {
		list.sort(sortTasks);
	}

	const result: GroupedTasks[] = [];
	let total = 0;

	for (const group of GROUP_ORDER) {
		const list = groups.get(group);
		if (!list || list.length === 0) continue;

		const remaining = MAX_ITEMS - total;
		if (remaining <= 0) break;

		result.push({
			group,
			tasks: list.slice(0, remaining),
		});
		total += Math.min(list.length, remaining);
	}

	return result;
}

export function MyFocusWidget() {
	const { tasks, isLoading } = useTasks(false);
	const currentUserResult = useQuery(api.users.getCurrentUser);
	const currentUserState = useRetainedQueryResult(currentUserResult);
	const currentUser = currentUserState.data;
	const { updateTask } = useTaskMutations();
	const userId = currentUser?._id;

	const focusGroups = useMemo(() => {
		if (!userId) return [];
		return buildFocusGroups(tasks, userId);
	}, [tasks, userId]);

	const handleMarkDone = useCallback(
		(taskId: Id<"tasks">) => {
			updateTask(taskId, { status: "done" })
				.then(() => toast.success("Task marked as done"))
				.catch(onMutationError);
		},
		[updateTask],
	);

	const showLoading = isLoading || currentUserState.isLoading;

	return (
		<DashboardWidgetCard
			title={
				<span className="flex items-center gap-2 text-sm font-medium">
					My Focus
				</span>
			}
			footerText="View all my tasks"
			footerTo="/tasks/my"
		>
			{showLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 5 }).map((_, i) => (
						<div
							key={`skeleton-${i.toString()}`}
							className="flex items-center gap-2 py-1.5"
						>
							<div className="size-4 animate-pulse rounded-full bg-muted" />
							<div className="h-4 w-12 animate-pulse rounded bg-muted" />
							<div className="h-4 flex-1 animate-pulse rounded bg-muted" />
						</div>
					))}
				</div>
			) : focusGroups.length === 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
					<CheckCircle2 className="size-8 text-success-foreground" />
					<span className="text-sm text-muted-foreground">
						No tasks assigned to you
					</span>
				</div>
			) : (
				<div className="min-w-0 space-y-3">
					{focusGroups.map(({ group, tasks: groupTasks }) => {
						const config = GROUP_CONFIG[group];
						return (
							<div key={group} className="min-w-0">
								<div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
									{config.label}
								</div>
								<div
									className={cn(
										"min-w-0 overflow-hidden rounded-md border border-border/70",
										config.borderClass && `border-l-2 ${config.borderClass}`,
									)}
								>
									{groupTasks.map((task) => (
										<CompactTaskRow
											key={task.id}
											task={task}
											onMarkDone={
												userId && !isTaskPendingUserReview(task, userId)
													? handleMarkDone
													: undefined
											}
											showViewAction={
												!!userId && isTaskPendingUserReview(task, userId)
											}
										/>
									))}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</DashboardWidgetCard>
	);
}
