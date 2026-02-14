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
	type TaskParentDisplayMode,
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
const statusDotColors: Record<TaskStatus, string> = {
	backlog: "bg-muted-foreground/40",
	"to-do": "bg-blue-500",
	"in-progress": "bg-yellow-500",
	"awaiting-review": "bg-purple-500",
	done: "bg-green-500",
	cancelled: "bg-red-500",
};

const isTaskStatus = (value: string): value is TaskStatus =>
	Object.hasOwn(statusDotColors, value);

const statusGroupRenderer: GroupValueRenderer = (value) => {
	if (typeof value !== "string") return <span>{String(value)}</span>;
	if (!isTaskStatus(value)) return <span>{value}</span>;
	const status = value;
	return (
		<div className="flex items-center gap-1.5">
			<span className={cn("size-2 rounded-full", statusDotColors[status])} />
			<span className="font-semibold text-sm">{statusLabels[status]}</span>
		</div>
	);
};

const isTaskPriority = (value: string): value is TaskPriority =>
	Object.hasOwn(priorityLabels, value);

const priorityGroupRenderer: GroupValueRenderer = (value) => {
	if (typeof value !== "string") return <span>{String(value)}</span>;
	if (!isTaskPriority(value)) return <span>{value}</span>;
	const priority = value;
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
	return <span className="font-semibold text-sm">{formatDate(value)}</span>;
};

const labelsGroupRenderer: GroupValueRenderer = (_value, row) => {
	const leafRows = row.getLeafRows();
	if (leafRows.length === 0) {
		return (
			<span className="text-muted-foreground font-semibold text-sm">
				No label
			</span>
		);
	}
	const firstTask = leafRows[0].original;
	const labels = firstTask.labels;
	if (labels.length === 0) {
		return (
			<span className="text-muted-foreground font-semibold text-sm">
				No label
			</span>
		);
	}

	return (
		<div className="flex items-center gap-2">
			{labels.map((label) => (
				<div key={label.id} className="flex items-center gap-1">
					<span
						className="size-2 rounded-full"
						style={{ backgroundColor: label.color }}
					/>
					<span className="font-semibold text-sm">{label.name}</span>
				</div>
			))}
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

export function useTaskColumns(options?: {
	parentDisplayMode?: TaskParentDisplayMode;
	hideParentDisplayName?: boolean;
}): ColumnDef<Task>[] {
	const parentDisplayMode =
		options?.parentDisplayMode ??
		(options?.hideParentDisplayName ? "none" : "full");
	return useMemo(
		() => [
			createSortableColumn(
				"priority",
				"",
				({ row }) => (
					<PriorityCell
						priority={row.getValue<TaskPriority>("priority")}
						taskId={row.original.id}
					/>
				),
				{
					sortingFn: (rowA, rowB) => {
						const priorityA = rowA.getValue<TaskPriority>("priority");
						const priorityB = rowB.getValue<TaskPriority>("priority");
						return taskPriorityOrder[priorityA] - taskPriorityOrder[priorityB];
					},
					meta: {
						groupValueRenderer: priorityGroupRenderer,
						cellClassName: "px-1 w-0",
						headerClassName: "px-1 w-0",
					} satisfies ColumnDef<Task>["meta"],
				},
			),
			createSortableColumn(
				"identifier",
				"",
				({ row }) => (
					<IdentifierCell identifier={row.getValue<string>("identifier")} />
				),
				{
					meta: {
						cellClassName: "px-1 w-0",
						headerClassName: "px-1 w-0",
					} satisfies ColumnDef<Task>["meta"],
				},
			),
			createSortableColumn(
				"status",
				"",
				({ row }) => (
					<StatusCell
						status={row.getValue<TaskStatus>("status")}
						taskId={row.original.id}
					/>
				),
				{
					sortingFn: (rowA, rowB) => {
						const statusA = rowA.getValue<TaskStatus>("status");
						const statusB = rowB.getValue<TaskStatus>("status");
						return taskStatusOrder[statusA] - taskStatusOrder[statusB];
					},
					meta: {
						groupValueRenderer: statusGroupRenderer,
						cellClassName: "px-1 w-0",
						headerClassName: "px-1 w-0",
					} satisfies ColumnDef<Task>["meta"],
				},
			),
			{
				id: "owner",
				accessorFn: (row) => {
					if (!row.owner) return "Unassigned";
					if ("members" in row.owner) return `team:${row.owner.id}`;
					return `user:${row.owner.id}`;
				},
				header: "",
				cell: ({ row }) => (
					<OwnerCell owner={row.original.owner} taskId={row.original.id} />
				),
				enableSorting: true,
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
				} satisfies ColumnDef<Task>["meta"],
			},
			createSortableColumn(
				"title",
				"",
				({ row }) => (
					<TaskTitleCell
						task={row.original}
						parentDisplayMode={parentDisplayMode}
					/>
				),
				{
					meta: {
						cellClassName: "min-w-0 w-full",
					} satisfies ColumnDef<Task>["meta"],
				},
			),
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
				} satisfies ColumnDef<Task>["meta"],
			},
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
				} satisfies ColumnDef<Task>["meta"],
			},
			{
				id: "dueDate",
				accessorFn: (row) => {
					if (!row.dueDate) return null;
					return row.dueDate.split("T")[0];
				},
				header: "",
				cell: ({ row }) => (
					<DueDateCell
						dueDate={row.original.dueDate}
						createdAt={row.original.createdAt}
					/>
				),
				enableSorting: true,
				meta: {
					groupValueRenderer: dateGroupRenderer,
					cellClassName: "px-1 text-right pr-4 w-0",
				} satisfies ColumnDef<Task>["meta"],
			},
		],
		[parentDisplayMode],
	);
}
