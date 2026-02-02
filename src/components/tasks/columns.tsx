import type { Column, ColumnDef, Row } from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo } from "react";
import type React from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import type { Task, TaskPriority, TaskStatus } from "@/data/types-new";
import { formatDate } from "@/lib/format-utils";
import { priorityLabels, statusLabels } from "@/lib/task-constants";
import {
	taskPriorityOrder,
	taskStatusOrder,
} from "@/lib/task-filter-definitions";
import { getPriorityIcon } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import {
	AssigneeCell,
	DueDateCell,
	IdentifierCell,
	LabelsCell,
	OwnerCell,
	PriorityCell,
	StatusCell,
	TaskTitleCell,
} from "./cell-components";

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
	"awaiting-review": "bg-purple-500",
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
		<UserAvatar
			user={assignee}
			size="sm"
			showName
			nameClassName="font-semibold text-sm"
		/>
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
		<UserAvatar
			user={owner}
			size="sm"
			showName
			nameClassName="font-semibold text-sm"
		/>
	);
};

export function useTaskColumns(): ColumnDef<Task>[] {
	return useMemo(
		() => [
			// Priority icon (first column - small)
			createSortableColumn(
				"priority",
				"",
				({ row }) => (
					<PriorityCell
						priority={row.getValue("priority") as TaskPriority}
						taskId={row.original.id}
					/>
				),
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
				({ row }) => (
					<IdentifierCell identifier={row.getValue("identifier") as string} />
				),
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
				({ row }) => (
					<StatusCell
						status={row.getValue("status") as TaskStatus}
						taskId={row.original.id}
					/>
				),
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
				({ row }) => (
					<OwnerCell owner={row.original.owner} taskId={row.original.id} />
				),
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
			createSortableColumn(
				"title",
				"",
				({ row }) => <TaskTitleCell task={row.original} />,
				{
					meta: {
						cellClassName: "min-w-0 w-full",
					} as ColumnDef<Task>["meta"],
				},
			),
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
				cell: ({ row }) => (
					<LabelsCell labels={row.original.labels} taskId={row.original.id} />
				),
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
				cell: ({ row }) => (
					<AssigneeCell
						assignee={row.original.assignee}
						taskId={row.original.id}
					/>
				),
				meta: {
					groupValueRenderer: assigneeGroupRenderer,
					cellClassName: "px-1 w-0",
				} as ColumnDef<Task>["meta"],
			},
			// Due date (short format)
			createSortableColumn(
				"dueDate",
				"",
				({ row }) => (
					<DueDateCell
						dueDate={row.getValue("dueDate") as string | null}
						createdAt={row.original.createdAt}
					/>
				),
				{
					meta: {
						groupValueRenderer: dateGroupRenderer,
						cellClassName: "px-1 text-right pr-4 w-0",
					} as ColumnDef<Task>["meta"],
				},
			),
		],
		[],
	); // Empty deps = never recreates
}
