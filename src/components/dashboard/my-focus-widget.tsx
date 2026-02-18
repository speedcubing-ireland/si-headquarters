import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useTaskColumns } from "@/components/tasks/columns";
import { TasksDataTable } from "@/components/tasks/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Task, TaskPriority } from "@/data/types-new";
import { useTasks, useTaskMutations } from "@/hooks/use-convex-data";
import { emptyTasksFilters } from "@/lib/filter-types";
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

const FOCUS_COLUMN_KEYS = new Set([
	"priority",
	"identifier",
	"status",
	"title",
]);
const MOBILE_COMPACT_HIDDEN_COLUMN_KEYS = new Set([
	"priority",
	"identifier",
	"status",
]);
type FocusColumnMeta = {
	cellClassName?: string;
	headerClassName?: string;
};

const FOCUS_ORDERING = { field: null, direction: "asc" } as const;

function getColumnKey(column: ColumnDef<Task, unknown>): string | null {
	if ("id" in column && typeof column.id === "string") return column.id;
	if ("accessorKey" in column && typeof column.accessorKey === "string") {
		return column.accessorKey;
	}
	return null;
}

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

export function getDueBadge(dueDate: string | null): {
	text: string;
	className: string;
} | null {
	if (!dueDate) return null;

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const due = new Date(dueDate);
	const diffDays = Math.ceil(
		(due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
	);

	if (diffDays < 0) {
		const absDays = Math.abs(diffDays);
		return {
			text: absDays === 1 ? "1 day ago" : `${absDays} days ago`,
			className: "border-error/50 text-error-foreground",
		};
	}
	if (diffDays === 0) {
		return {
			text: "Today",
			className: "border-error/50 text-error-foreground",
		};
	}
	if (diffDays === 1) {
		return {
			text: "Tomorrow",
			className: "border-warning/50 text-warning-foreground",
		};
	}
	if (diffDays <= 3) {
		return {
			text: `in ${diffDays}d`,
			className: "border-warning/50 text-warning-foreground",
		};
	}
	return {
		text: `in ${diffDays}d`,
		className: "",
	};
}

export function MyFocusWidget() {
	const { tasks, isLoading } = useTasks(false);
	const currentUser = useQuery(api.users.getCurrentUser);
	const { updateTask } = useTaskMutations();
	const userId = currentUser?._id;
	const taskColumns = useTaskColumns({ parentDisplayMode: "full" });

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

	const handleOrderingChange = useCallback(
		(_field: string | null, _direction: "asc" | "desc") => {},
		[],
	);

	const focusColumns = useMemo<ColumnDef<Task, unknown>[]>(() => {
		const reusableColumns = taskColumns
			.filter((column) => {
				const key = getColumnKey(column);
				return key ? FOCUS_COLUMN_KEYS.has(key) : false;
			})
			.map((column) => {
				const key = getColumnKey(column);
				if (!key || !MOBILE_COMPACT_HIDDEN_COLUMN_KEYS.has(key)) return column;
				const meta = (column.meta as FocusColumnMeta | undefined) ?? undefined;
				return {
					...column,
					meta: {
						...meta,
						cellClassName: cn(meta?.cellClassName, "hidden sm:table-cell"),
						headerClassName: cn(meta?.headerClassName, "hidden sm:table-cell"),
					} satisfies FocusColumnMeta,
				};
			});

		const markDoneColumn: ColumnDef<Task, unknown> = {
			id: "mark-done",
			header: "",
			enableSorting: false,
			cell: ({ row }) => {
				const task = row.original;
				const showViewAction =
					!!userId && isTaskPendingUserReview(task, userId);

				if (showViewAction) {
					return (
						<Tooltip>
							<TooltipTrigger asChild>
								<Link
									to="/tasks/$id"
									params={{ id: task.id }}
									onClick={(event) => event.stopPropagation()}
									className="inline-flex h-7 items-center rounded-md px-2 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-muted/50 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
								>
									View
								</Link>
							</TooltipTrigger>
							<TooltipContent side="left" sideOffset={4}>
								View task
							</TooltipContent>
						</Tooltip>
					);
				}

				return (
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									handleMarkDone(task.id);
								}}
								className="inline-flex size-7 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-muted/50 focus-visible:opacity-100 group-hover:opacity-100"
								aria-label={`Mark "${task.title}" as done`}
							>
								<CheckCircle2 className="size-4 text-muted-foreground hover:text-success-foreground" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="left" sideOffset={4}>
							Mark as done
						</TooltipContent>
					</Tooltip>
				);
			},
			meta: {
				cellClassName: "w-0 px-1 text-right",
				headerClassName: "w-0 px-1",
			} satisfies ColumnDef<Task>["meta"],
		};

		return [...reusableColumns, markDoneColumn];
	}, [taskColumns, handleMarkDone, userId]);

	const showLoading = isLoading || currentUser === undefined;

	return (
		<Card className="min-w-0 flex flex-col">
			<CardHeader className="px-4 pb-2 sm:px-6">
				<CardTitle className="flex items-center gap-2 text-sm font-medium">
					My Focus
				</CardTitle>
			</CardHeader>
			<CardContent className="flex min-w-0 flex-1 flex-col px-4 sm:px-6">
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
										<TasksDataTable
											columns={focusColumns}
											tasks={groupTasks}
											filters={emptyTasksFilters}
											matchMode="all"
											grouping={null}
											subGrouping={null}
											ordering={FOCUS_ORDERING}
											onOrderingChange={handleOrderingChange}
											skipClientFiltering
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}

				<Link
					to="/tasks/my"
					className="mt-auto flex items-center gap-1 border-t pt-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					View all my tasks
					<ArrowRight className="size-3" />
				</Link>
			</CardContent>
		</Card>
	);
}
