import { Link } from "@tanstack/react-router";
import type { Column, ColumnDef, Row } from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";
import type React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDataV2 } from "@/data/data-store-v2";
import type { Task, TaskPriority, TaskStatus } from "@/data/types-new";
import {
	priorityLabels,
	statusColors,
	statusLabels,
} from "@/lib/task-constants";
import { taskPriorityOrder, taskStatusOrder } from "@/lib/task-filter-config";
import {
	formatDate,
	getInitials,
	getPriorityIcon,
	getStatusIcon,
} from "@/lib/task-utils";
import {
	EditableTaskAssignee,
	EditableTaskLabels,
	EditableTaskPriority,
	EditableTaskStatus,
	TaskDateDisplay,
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

const statusGroupRenderer: GroupValueRenderer = (value) => {
	if (typeof value !== "string") return <span>{String(value)}</span>;
	const status = value as TaskStatus;
	const Icon = getStatusIcon(status);
	return (
		<Badge className={statusColors[status]}>
			<Icon className="size-3 mr-1" />
			{statusLabels[status]}
		</Badge>
	);
};

const priorityGroupRenderer: GroupValueRenderer = (value) => {
	if (typeof value !== "string") return <span>{String(value)}</span>;
	const priority = value as TaskPriority;
	const Icon = getPriorityIcon(priority);
	return (
		<span className="flex items-center gap-1">
			<Icon className="size-4" />
			<span className="font-bold">{priorityLabels[priority]}</span>
		</span>
	);
};

const assigneeGroupRenderer: GroupValueRenderer = (_value, row) => {
	const leafRows = row.getLeafRows();
	if (leafRows.length === 0) {
		return <span className="text-muted-foreground">Unassigned</span>;
	}
	const firstRow = leafRows[0];
	const assignee = firstRow.original.assignee;
	if (!assignee) {
		return <span className="text-muted-foreground font-bold">Unassigned</span>;
	}
	return (
		<div className="flex items-center gap-1.5">
			<Avatar className="size-5">
				<AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
				<AvatarFallback className="text-[10px]">
					{getInitials(assignee.name)}
				</AvatarFallback>
			</Avatar>
			<span className="font-bold">{assignee.name}</span>
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
	return <span className="font-bold">{formatDate(value as string)}</span>;
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
		return <span className="text-muted-foreground">Unassigned</span>;
	}
	const firstRow = leafRows[0];
	const owner = firstRow.original.owner;
	if (!owner) {
		return <span className="text-muted-foreground font-bold">Unassigned</span>;
	}
	if ("members" in owner) {
		return (
			<span className="font-bold">
				Team:{" "}
				<span className="inline-flex items-center gap-1">
					<span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[8px]">
						T
					</span>
					{owner.name}
				</span>
			</span>
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
			<span className="font-bold">{owner.name}</span>
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
		<div className="flex items-center gap-2 max-w-[320px]">
			<Link
				to="/tasks/$id"
				params={{ id: task.id }}
				className="font-medium truncate hover:text-primary hover:underline"
			>
				<span className="truncate">
					{task.title}
					{parent ? (
						<span className="text-muted-foreground">
							{" "}
							&gt; {parent.title}
						</span>
					) : null}
				</span>
			</Link>
			{showProgress && (
				<span className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground bg-muted">
					{done}/{total}
				</span>
			)}
		</div>
	);
}

export const taskColumns: ColumnDef<Task>[] = [
	{
		accessorKey: "identifier",
		header: "ID",
		cell: ({ row }) => {
			const identifier = row.getValue("identifier") as string;
			return (
				<span className="text-xs text-muted-foreground font-mono">
					{identifier}
				</span>
			);
		},
		enableSorting: false,
	},
	createSortableColumn("title", "Title", ({ row }) => <TaskTitleCell row={row} />),
	createSortableColumn(
		"status",
		"Status",
		({ row }) => {
			const status = row.getValue("status") as TaskStatus;
			const task = row.original;
			return <EditableTaskStatus status={status} taskId={task.id} />;
		},
		{
			sortingFn: (rowA, rowB) => {
				const statusA = rowA.getValue("status") as TaskStatus;
				const statusB = rowB.getValue("status") as TaskStatus;
				return taskStatusOrder[statusA] - taskStatusOrder[statusB];
			},
			meta: {
				groupValueRenderer: statusGroupRenderer,
			} as ColumnDef<Task>["meta"],
		},
	),
	createSortableColumn(
		"priority",
		"Priority",
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
			} as ColumnDef<Task>["meta"],
		},
	),
	{
		accessorKey: "owner",
		header: "Owner",
		cell: ({ row }) => {
			const owner = row.original.owner;
			if (!owner) {
				return (
					<span className="text-xs text-muted-foreground">Unassigned</span>
				);
			}
			if ("members" in owner) {
				return (
					<Link
						to="/teams/$teamId"
						params={{ teamId: owner.id }}
						className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
					>
						<span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[8px]">
							T
						</span>
						<span className="truncate max-w-[140px]">{owner.name}</span>
					</Link>
				);
			}
			return (
				<div className="flex items-center gap-1.5">
					<Avatar className="size-4">
						<AvatarImage src={owner.avatarUrl} alt={owner.name} />
						<AvatarFallback className="text-[8px]">
							{getInitials(owner.name)}
						</AvatarFallback>
					</Avatar>
					<span className="text-xs truncate max-w-[140px]">
						{owner.name}
					</span>
				</div>
			);
		},
		meta: {
			groupValueRenderer: ownerGroupRenderer,
		} as ColumnDef<Task>["meta"],
	},
	{
		accessorKey: "assignee",
		accessorFn: (row) => row.assignee?.name ?? "Unassigned",
		header: "Assignee",
		cell: ({ row }) => {
			const assignee = row.original.assignee;
			const task = row.original;
			return <EditableTaskAssignee assignee={assignee} taskId={task.id} />;
		},
		meta: {
			groupValueRenderer: assigneeGroupRenderer,
		} as ColumnDef<Task>["meta"],
	},
	{
		accessorKey: "labels",
		accessorFn: (row) =>
			row.labels.length > 0
				? row.labels
						.map((l) => l.name)
						.sort()
						.join(", ")
				: "No labels",
		header: "Labels",
		cell: ({ row }) => {
			const labels = row.original.labels;
			const task = row.original;
			return <EditableTaskLabels labels={labels} taskId={task.id} />;
		},
		enableSorting: true,
	},
	createSortableColumn(
		"dueDate",
		"Due Date",
		({ row }) => {
			const date = row.getValue("dueDate") as string | null;
			return <TaskDateDisplay date={date} />;
		},
		{
			meta: {
				groupValueRenderer: dateGroupRenderer,
			} as ColumnDef<Task>["meta"],
		},
	),
];
