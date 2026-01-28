import { Link } from "@tanstack/react-router";
import type { Column, ColumnDef, Row } from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";
import type React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	createSortableColumn("title", "Title", ({ row }) => {
		const title = row.getValue("title") as string;
		const task = row.original;
		return (
			<Link
				to="/tasks/$id"
				params={{ id: task.id }}
				className="font-medium truncate max-w-[300px] hover:text-primary hover:underline"
			>
				{title}
			</Link>
		);
	}),
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
