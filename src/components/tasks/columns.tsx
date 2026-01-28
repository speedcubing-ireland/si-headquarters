import type { Column, ColumnDef, Row } from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";
import type React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDataV2 } from "@/data/data-store-v2";
import type { Task, TaskPriority, TaskStatus } from "@/data/types-new";
import { priorityLabels, statusLabels } from "@/lib/task-constants";
import { taskPriorityOrder, taskStatusOrder } from "@/lib/task-filter-config";
import {
	formatDate,
	formatDateShort,
	getInitials,
	getPriorityIcon,
	getStatusIcon,
} from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import {
	EditableTaskAssignee,
	EditableTaskLabels,
	EditableTaskOwner,
	EditableTaskPriority,
	EditableTaskStatus,
} from "./editable-cells";

function SortableHeader({
	column,
	children,
}: {
	column: Column<Task, unknown>;
	children: React.ReactNode;
}) {
	const sorted = column.getIsSorted();

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={column.getToggleSortingHandler()}
			className="h-7 px-2 font-medium justify-start group"
		>
			{children}
			<span className="ml-2">
				{sorted === "asc" ? (
					<ArrowUp className="size-4" />
				) : sorted === "desc" ? (
					<ArrowDown className="size-4" />
				) : (
					<ArrowUp className="size-4 opacity-0 group-hover:opacity-50 transition-opacity" />
				)}
			</span>
		</Button>
	);
}

type SortableColumnOptions = {
	sortingFn?: ColumnDef<Task>["sortingFn"];
	meta?: ColumnDef<Task>["meta"];
};

type GroupValueRenderer = (value: unknown, row: Row<Task>) => React.ReactNode;

// Status colors for group headers (colored dots)
const statusDotColors: Record<TaskStatus, string> = {
	backlog: "bg-muted-foreground/40",
	"to-do": "bg-blue-500",
	"in-progress": "bg-yellow-500",
	done: "bg-green-500",
	cancelled: "bg-red-500",
};

const statusGroupRenderer: GroupValueRenderer = (value) => {
	if (typeof value !== "string") return <span>{String(value)}</span>;
	const status = value as TaskStatus;
	return (
		<div className="flex items-center gap-1.5">
			<span className={cn("size-2 rounded-full", statusDotColors[status])} />
			<span className="font-semibold text-sm">{statusLabels[status]}</span>
		</div>
	);
};

const priorityGroupRenderer: GroupValueRenderer = (value) => {
	if (typeof value !== "string") return <span>{String(value)}</span>;
	const priority = value as TaskPriority;
	const Icon = getPriorityIcon(priority);
	return (
		<div className="flex items-center gap-1.5">
			<Icon className="size-4 text-muted-foreground" />
			<span className="font-semibold text-sm">{priorityLabels[priority]}</span>
		</div>
	);
};

const assigneeGroupRenderer: GroupValueRenderer = (_value, row) => {
	const leafRows = row.getLeafRows();
	if (leafRows.length === 0) {
		return (
			<span className="text-muted-foreground font-semibold text-sm">
				Unassigned
			</span>
		);
	}
	const firstRow = leafRows[0];
	const assignee = firstRow.original.assignee;
	if (!assignee) {
		return (
			<span className="text-muted-foreground font-semibold text-sm">
				Unassigned
			</span>
		);
	}
	return (
		<div className="flex items-center gap-1.5">
			<Avatar className="size-5">
				<AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
				<AvatarFallback className="text-[10px]">
					{getInitials(assignee.name)}
				</AvatarFallback>
			</Avatar>
			<span className="font-semibold text-sm">{assignee.name}</span>
		</div>
	);
};

const dateGroupRenderer: GroupValueRenderer = (value) => {
	if (typeof value !== "string" && value !== undefined && value !== null) {
		return null;
	}
	if (!value) {
		return <span className="text-muted-foreground">No date</span>;
	}
	return (
		<span className="font-semibold text-sm">{formatDate(value as string)}</span>
	);
};

const labelsGroupRenderer: GroupValueRenderer = (value, row) => {
	if (!value || value === "No labels") {
		return (
			<span className="text-muted-foreground font-semibold text-sm">
				No label
			</span>
		);
	}
	// Get the first label from the group to show its color
	const leafRows = row.getLeafRows();
	if (leafRows.length === 0)
		return <span className="font-semibold text-sm">{String(value)}</span>;
	const firstTask = leafRows[0].original;
	const label = firstTask.labels[0];
	if (!label)
		return <span className="font-semibold text-sm">{String(value)}</span>;

	return (
		<div className="flex items-center gap-1.5">
			<span
				className="size-2 rounded-full"
				style={{ backgroundColor: label.color }}
			/>
			<span className="font-semibold text-sm">{label.name}</span>
		</div>
	);
};

function createSortableColumn(
	accessorKey: keyof Task & string,
	headerLabel: string,
	cell: ColumnDef<Task>["cell"],
	options: SortableColumnOptions = {},
): ColumnDef<Task> {
	const { sortingFn, meta } = options;

	return {
		accessorKey,
		header: ({ column }) => (
			<SortableHeader column={column}>{headerLabel}</SortableHeader>
		),
		cell,
		enableSorting: true,
		...(sortingFn && { sortingFn }),
		...(meta && { meta }),
	};
}

const ownerGroupRenderer: GroupValueRenderer = (_value, row) => {
	const leafRows = row.getLeafRows();
	if (leafRows.length === 0) {
		return (
			<span className="text-muted-foreground font-semibold text-sm">
				Unassigned
			</span>
		);
	}
	const firstRow = leafRows[0];
	const owner = firstRow.original.owner;
	if (!owner) {
		return (
			<span className="text-muted-foreground font-semibold text-sm">
				Unassigned
			</span>
		);
	}
	if ("members" in owner) {
		return (
			<div className="flex items-center gap-1.5">
				<span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[8px]">
					T
				</span>
				<span className="font-semibold text-sm">{owner.name}</span>
			</div>
		);
	}
	return (
		<div className="flex items-center gap-1.5">
			<Avatar className="size-5">
				<AvatarImage src={owner.avatarUrl} alt={owner.name} />
				<AvatarFallback className="text-[10px]">
					{getInitials(owner.name)}
				</AvatarFallback>
			</Avatar>
			<span className="font-semibold text-sm">{owner.name}</span>
		</div>
	);
};

function TaskTitleCell({ row }: { row: Row<Task> }) {
	const task = row.original;
	const parent = useDataV2((state) => state.getTaskParent(task));
	// IMPORTANT: avoid returning a fresh object from the selector (can cause
	// infinite render loops with useSyncExternalStore in React dev).
	const done = useDataV2((state) => state.getSubtaskProgress(task.id).done);
	const total = useDataV2((state) => state.getSubtaskProgress(task.id).total);

	const showProgress = total > 0;

	return (
		<div className="flex items-center min-w-0">
			<span className="min-w-0 truncate">
				<span className="font-medium text-foreground">{task.title}</span>
				{parent && (
					<span className="ml-1 text-xs text-muted-foreground/80">
						&gt; {parent.title}
					</span>
				)}
			</span>
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
}

// Status icon colors matching Linear
const statusIconColors: Record<TaskStatus, string> = {
	backlog: "text-muted-foreground/60",
	"to-do": "text-muted-foreground",
	"in-progress": "text-yellow-500",
	done: "text-green-500",
	cancelled: "text-red-500",
};

export const taskColumns: ColumnDef<Task>[] = [
	// Priority icon (first column - small)
	createSortableColumn(
		"priority",
		"",
		({ row }) => {
			const priority = row.getValue("priority") as TaskPriority;
			const task = row.original;
			return <EditableTaskPriority priority={priority} taskId={task.id} />;
		},
		{
			sortingFn: (rowA, rowB) => {
				const priorityA = rowA.getValue("priority") as TaskPriority;
				const priorityB = rowB.getValue("priority") as TaskPriority;
				return taskPriorityOrder[priorityA] - taskPriorityOrder[priorityB];
			},
			meta: {
				groupValueRenderer: priorityGroupRenderer,
				cellClassName: "px-1 w-0",
				headerClassName: "px-1 w-0",
			} as ColumnDef<Task>["meta"],
		},
	),
	// Task identifier
	createSortableColumn(
		"identifier",
		"",
		({ row }) => {
			const identifier = row.getValue("identifier") as string;
			return (
				<span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
					{identifier}
				</span>
			);
		},
		{
			meta: {
				cellClassName: "px-1 w-0",
				headerClassName: "px-1 w-0",
			} as ColumnDef<Task>["meta"],
		},
	),
	// Status icon with time estimate
	createSortableColumn(
		"status",
		"",
		({ row }) => {
			const status = row.getValue("status") as TaskStatus;
			const task = row.original;
			const StatusIcon = getStatusIcon(status);

			return (
				<EditableTaskStatus status={status} taskId={task.id}>
					<StatusIcon className={cn("size-4", statusIconColors[status])} />
				</EditableTaskStatus>
			);
		},
		{
			sortingFn: (rowA, rowB) => {
				const statusA = rowA.getValue("status") as TaskStatus;
				const statusB = rowB.getValue("status") as TaskStatus;
				return taskStatusOrder[statusA] - taskStatusOrder[statusB];
			},
			meta: {
				groupValueRenderer: statusGroupRenderer,
				cellClassName: "px-1 w-0",
				headerClassName: "px-1 w-0",
			} as ColumnDef<Task>["meta"],
		},
	),
	// Owner (compact)
	createSortableColumn(
		"owner",
		"",
		({ row }) => {
			const task = row.original;
			return <EditableTaskOwner owner={task.owner} taskId={task.id} />;
		},
		{
			// Sort owners by display name, falling back to empty string for unassigned.
			sortingFn: (rowA, rowB) => {
				const ownerA = rowA.original.owner;
				const ownerB = rowB.original.owner;
				const nameA =
					ownerA && "name" in ownerA && typeof ownerA.name === "string"
						? ownerA.name
						: "";
				const nameB =
					ownerB && "name" in ownerB && typeof ownerB.name === "string"
						? ownerB.name
						: "";
				return nameA.localeCompare(nameB);
			},
			meta: {
				groupValueRenderer: ownerGroupRenderer,
				cellClassName: "px-1 w-0",
			} as ColumnDef<Task>["meta"],
		},
	),
	// Title with parent
	createSortableColumn("title", "", ({ row }) => <TaskTitleCell row={row} />, {
		meta: {
			cellClassName: "min-w-0 w-full",
		} as ColumnDef<Task>["meta"],
	}),
	// Labels (right side)
	{
		accessorKey: "labels",
		accessorFn: (row) =>
			row.labels.length > 0
				? row.labels
						.map((l) => l.name)
						.sort()
						.join(", ")
				: "No labels",
		header: "",
		cell: ({ row }) => {
			const labels = row.original.labels;
			const task = row.original;
			return <EditableTaskLabels labels={labels} taskId={task.id} />;
		},
		enableSorting: true,
		meta: {
			groupValueRenderer: labelsGroupRenderer,
			cellClassName: "px-1 text-right w-0",
		} as ColumnDef<Task>["meta"],
	},
	// Assignee avatar (right side)
	{
		accessorKey: "assignee",
		accessorFn: (row) => row.assignee?.name ?? "Unassigned",
		header: "",
		cell: ({ row }) => {
			const task = row.original;
			return (
				<EditableTaskAssignee
					assignee={task.assignee}
					taskId={task.id}
					variant="icon"
				/>
			);
		},
		meta: {
			groupValueRenderer: assigneeGroupRenderer,
			cellClassName: "px-1 w-0",
		} as ColumnDef<Task>["meta"],
	},
	// Due date (short format)
	createSortableColumn(
		"dueDate",
		"",
		({ row }) => {
			const date = row.getValue("dueDate") as string | null;
			const created = row.original.createdAt;

			return (
				<div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
					<span>{created ? formatDateShort(created) : "-"}</span>
					<span>{date ? formatDateShort(date) : "-"}</span>
				</div>
			);
		},
		{
			meta: {
				groupValueRenderer: dateGroupRenderer,
				cellClassName: "px-1 text-right pr-4 w-0",
			} as ColumnDef<Task>["meta"],
		},
	),
];
