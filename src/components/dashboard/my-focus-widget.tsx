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

// ── Constants ────────────────────────────────────────────────────────────────

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

const FOCUS_COLUMN_KEYS = new Set(["priority", "identifier", "status", "title"]);

const FOCUS_ORDERING = { field: null, direction: "asc" } as const;

function getColumnKey(column: ColumnDef<Task, unknown>): string | null {
	if ("id" in column && typeof column.id === "string") return column.id;
	if ("accessorKey" in column && typeof column.accessorKey === "string") {
		return column.accessorKey;
	}
	return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function classifyTask(
	task: Task,
	userId: string,
	today: Date,
	weekFromNow: Date,
): FocusGroup | null {
	const isDone = task.status === "done" || task.status === "cancelled";
	if (isDone) return null;

	const isAssignedToMe = task.assignee?.id === userId;

	// Overdue (assigned to me, has dueDate before today)
	if (isAssignedToMe && task.dueDate) {
		const due = new Date(task.dueDate);
		if (due < today) return "overdue";
	}

	// Blocking others (assigned to me, has unresolved blocks)
	if (isAssignedToMe) {
		const unresolvedBlocks = task.blocks.filter(
			(b) => b.status !== "done" && b.status !== "cancelled",
		);
		if (unresolvedBlocks.length > 0) return "blocking";
	}

	// Needs your review (you're a required approver who hasn't approved)
	if (
		task.status === "awaiting-review" &&
		isUserRequiredApprover(task, userId) &&
		!task.approvedBy.some((u) => u.id === userId)
	) {
		return "needs-review";
	}

	// Everything below requires assignment to me
	if (!isAssignedToMe) return null;

	// Due this week
	if (task.dueDate) {
		const due = new Date(task.dueDate);
		if (due <= weekFromNow) return "due-this-week";
	}

	// In progress
	if (task.status === "in-progress") return "in-progress";

	// To do
	if (task.status === "to-do") return "to-do";

	return null;
}

export function sortTasks(a: Task, b: Task): number {
	// Primary: priority (urgent first)
	const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
	if (priorityDiff !== 0) return priorityDiff;

	// Secondary: due date (soonest first, no date last)
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

	// Sort tasks within each group
	for (const list of groups.values()) {
		list.sort(sortTasks);
	}

	// Build ordered result, respecting max items
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

// ── Due date display ─────────────────────────────────────────────────────────

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
			className: "border-red-500/50 text-red-600 dark:text-red-400",
		};
	}
	if (diffDays === 0) {
		return {
			text: "Today",
			className: "border-red-500/50 text-red-600 dark:text-red-400",
		};
	}
	if (diffDays === 1) {
		return {
			text: "Tomorrow",
			className: "border-orange-500/50 text-orange-600 dark:text-orange-400",
		};
	}
	if (diffDays <= 3) {
		return {
			text: `in ${diffDays}d`,
			className: "border-orange-500/50 text-orange-600 dark:text-orange-400",
		};
	}
	return {
		text: `in ${diffDays}d`,
		className: "",
	};
}

// ── Main Widget ──────────────────────────────────────────────────────────────

export function MyFocusWidget() {
	const { tasks, isLoading } = useTasks(false);
	const currentUser = useQuery(api.users.getCurrentUser);
	const { updateTask } = useTaskMutations();
	const userId = currentUser?._id;
	const taskColumns = useTaskColumns({ hideParentDisplayName: true });

	const focusGroups = useMemo(() => {
		if (!userId) return [];
		return buildFocusGroups(tasks, userId);
	}, [tasks, userId]);

	const handleMarkDone = useCallback((taskId: Id<"tasks">) => {
		updateTask(taskId, { status: "done" })
			.then(() => toast.success("Task marked as done"))
			.catch(onMutationError);
	}, [updateTask]);

	const handleOrderingChange = useCallback(
		(_field: string | null, _direction: "asc" | "desc") => {},
		[],
	);

	const focusColumns = useMemo<ColumnDef<Task, unknown>[]>(() => {
		const reusableColumns = taskColumns.filter((column) => {
			const key = getColumnKey(column);
			return key ? FOCUS_COLUMN_KEYS.has(key) : false;
		});

		const markDoneColumn: ColumnDef<Task, unknown> = {
			id: "mark-done",
			header: "",
			enableSorting: false,
			cell: ({ row }) => (
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={(event) => {
								event.stopPropagation();
								handleMarkDone(row.original.id);
							}}
							className="inline-flex size-7 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-muted/50 focus-visible:opacity-100 group-hover:opacity-100"
							aria-label={`Mark "${row.original.title}" as done`}
						>
							<CheckCircle2 className="size-4 text-muted-foreground hover:text-green-500" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="left" sideOffset={4}>
						Mark as done
					</TooltipContent>
				</Tooltip>
			),
			meta: {
				cellClassName: "w-0 px-1 text-right",
				headerClassName: "w-0 px-1",
			} satisfies ColumnDef<Task>["meta"],
		};

		return [...reusableColumns, markDoneColumn];
	}, [taskColumns, handleMarkDone]);

	const showLoading = isLoading || currentUser === undefined;

	return (
		<Card className="flex flex-col">
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center gap-2 text-sm font-medium">
					My Focus
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
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
						<CheckCircle2 className="size-8 text-green-500" />
						<span className="text-sm text-muted-foreground">
							No tasks assigned to you
						</span>
					</div>
				) : (
					<div className="space-y-3">
						{focusGroups.map(({ group, tasks: groupTasks }) => {
							const config = GROUP_CONFIG[group];
							return (
								<div key={group}>
									<div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
										{config.label}
									</div>
									<div
										className={cn(
											"overflow-hidden rounded-md border border-border/70",
											config.borderClass &&
												`border-l-2 ${config.borderClass}`,
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
