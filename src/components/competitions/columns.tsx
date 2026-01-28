import type { Column, ColumnDef, Row } from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Priority, Project, Status, User } from "@/data/types";
import { priorityOrder, statusOrder } from "@/lib/filter-config";
import {
	formatDate,
	getPriorityIcon,
	priorityLabels,
} from "@/lib/competitions-utils";
import { getStatusClass, getStatusLabel } from "@/lib/status-config";
import { LeadsDisplay } from "./leads-display";
import {
	DateDisplay,
	EditableLead,
	EditablePriority,
	EditableStatus,
} from "./editable-cells";

// Sortable header component
function SortableHeader({
	column,
	children,
}: {
	column: Column<Project, unknown>;
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
	sortingFn?: ColumnDef<Project>["sortingFn"];
	meta?: ColumnDef<Project>["meta"];
};

type GroupValueRenderer = (value: unknown, row: Row<Project>) => React.ReactNode;

const statusGroupRenderer: GroupValueRenderer = (value) => {
	if (typeof value !== "string") return <span>{String(value)}</span>;
	const status = value as Status;
	return (
		<Badge className={getStatusClass(status)}>
			{getStatusLabel(status)}
		</Badge>
	);
};

const priorityGroupRenderer: GroupValueRenderer = (value) => {
	if (typeof value !== "string") return <span>{String(value)}</span>;
	const priority = value as Priority;
	const Icon = getPriorityIcon(priority);
	return (
		<span className="flex items-center gap-1">
			<Icon className="size-4" />
			<span className="font-bold">{priorityLabels[priority]}</span>
		</span>
	);
};

const leadsGroupRenderer: GroupValueRenderer = (_value, row) => {
	const leafRows = row.getLeafRows();
	if (leafRows.length === 0) {
		return <LeadsDisplay leads={[]} variant="summary" bold />;
	}

	const firstRow = leafRows[0];
	const originalData = firstRow.original as Project;
	const leads: User[] = originalData.leads || [];
	return <LeadsDisplay leads={leads} variant="summary" bold />;
};

const dateGroupRenderer: GroupValueRenderer = (value) => {
	if (typeof value !== "string" && value !== undefined) {
		return null;
	}
	if (!value) {
		return <span className="text-muted-foreground">No date</span>;
	}
	return <span className="font-bold">{formatDate(value)}</span>;
};

const nameGroupRenderer: GroupValueRenderer = (value) => {
	if (typeof value !== "string") return null;
	return <span className="font-bold">{value}</span>;
};

function createSortableColumn(
	accessorKey: keyof Project & string,
	headerLabel: string,
	cell: ColumnDef<Project>["cell"],
	options: SortableColumnOptions = {},
): ColumnDef<Project> {
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

export const columns: ColumnDef<Project>[] = [
	createSortableColumn(
		"startDate",
		"Date",
		({ row }) => {
			const date = row.getValue("startDate") as string | undefined;
			return <DateDisplay date={date} />;
		},
		{
			meta: {
				groupValueRenderer: dateGroupRenderer,
			} as ColumnDef<Project>["meta"],
		},
	),
	createSortableColumn("name", "Name", ({ row }) => {
		const name = row.getValue("name") as string;
		return <span className="font-bold truncate">{name}</span>;
	}, {
		meta: {
			groupValueRenderer: nameGroupRenderer,
		} as ColumnDef<Project>["meta"],
	}),
	createSortableColumn("status", "Status", ({ row }) => {
		const status = row.getValue("status") as Status;
		const project = row.original;
		return <EditableStatus status={status} projectId={project.id} />;
		}, {
		sortingFn: (rowA, rowB) => {
			const statusA = rowA.getValue("status") as Status;
			const statusB = rowB.getValue("status") as Status;
			return statusOrder[statusA] - statusOrder[statusB];
		},
		meta: {
			groupValueRenderer: statusGroupRenderer,
		} as ColumnDef<Project>["meta"],
	}),
	createSortableColumn(
		"priority",
		"Priority",
		({ row }) => {
			const priority = row.getValue("priority") as Priority;
			const project = row.original;
			return <EditablePriority priority={priority} projectId={project.id} />;
		},
		{
			sortingFn: (rowA, rowB) => {
				const priorityA = rowA.getValue("priority") as Priority;
				const priorityB = rowB.getValue("priority") as Priority;
				return priorityOrder[priorityA] - priorityOrder[priorityB];
			},
			meta: {
				groupValueRenderer: priorityGroupRenderer,
			} as ColumnDef<Project>["meta"],
		}
	),
	{
		accessorKey: "leads",
		// Use accessorFn for grouping to properly compare array values
		// Returns a sorted, comma-separated string of lead names for consistent grouping
		accessorFn: (row) => {
			const leads = row.leads;
			if (!leads || leads.length === 0) return "No leads";
			// Sort lead names to ensure consistent grouping regardless of order
			return leads
				.map((lead) => lead.name)
				.sort()
				.join(", ");
		},
		header: "Lead",
		cell: ({ row }) => {
			// Use row.original.leads since accessorFn returns a string for grouping
			const leads = row.original.leads;
			const project = row.original;
			return <EditableLead leads={leads} projectId={project.id} />;
		},
		meta: {
			groupValueRenderer: leadsGroupRenderer,
		} as ColumnDef<Project>["meta"],
	},
];
