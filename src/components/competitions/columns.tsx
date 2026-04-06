import type { Column, ColumnDef, Row } from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";
import type React from "react";
import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	COMPETITION_PHASE_KEYS,
	type Competition,
	type CompetitionPhaseKey,
} from "@/data/types-new";
import {
	getCurrentPhaseKey,
	getPhaseVariant,
	getPhaseLabel,
} from "@/lib/competition-phase-config";
import { formatDate, getInitials } from "@/lib/format-utils";
import {
	EditableCompLeadCell,
	EditableLeadDelegateCell,
	EditableOrganisersCell,
	EditablePhaseCell,
} from "./editable-phase-and-roles";
import { LeadsDisplay } from "./leads-display";

function SortableHeader({
	column,
	children,
}: {
	column: Column<Competition, unknown>;
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
	sortingFn?: ColumnDef<Competition>["sortingFn"];
	meta?: ColumnDef<Competition>["meta"];
};

type GroupValueRenderer = (
	value: unknown,
	row: Row<Competition>,
) => React.ReactNode;
type TasksSummary = { completed: number; open: number; total: number };

const isCompetitionPhaseKey = (value: string): value is CompetitionPhaseKey =>
	COMPETITION_PHASE_KEYS.some((key) => key === value);

const phaseGroupRenderer: GroupValueRenderer = (value, row) => {
	const key =
		typeof value === "string" && isCompetitionPhaseKey(value)
			? value
			: getCurrentPhaseKey(row.original);
	return <Badge variant={getPhaseVariant(key)}>{getPhaseLabel(key)}</Badge>;
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

const tasksGroupRenderer: GroupValueRenderer = (_value, row) => {
	const comp = row.original;
	const summary = getTasksSummary(comp);
	return (
		<span className="font-mono text-xs">
			{summary.completed} / {summary.total}
		</span>
	);
};

const organisersGroupRenderer: GroupValueRenderer = (_value, row) => {
	const leafRows = row.getLeafRows();
	const first = leafRows.length > 0 ? leafRows[0].original : row.original;
	const organisers = first.organisers;
	if (!organisers || organisers.length === 0) {
		return <span className="text-muted-foreground">No organisers</span>;
	}

	const tooltipContent = (
		<div className="flex flex-col gap-0.5">
			{organisers
				.map((o: Competition["organisers"][number]) => o.name)
				.sort((a: string, b: string) => a.localeCompare(b))
				.map((name: string) => (
					<div key={name}>{name}</div>
				))}
		</div>
	);

	const avatarGroup = (
		<AvatarGroup className="group-data-[size=sm]/avatar-group:*:data-[slot=avatar]:size-4">
			{organisers.slice(0, 3).map((org: Competition["organisers"][number]) => (
				<Avatar key={org.id} className="size-4">
					<AvatarImage src={org.avatarUrl} alt={org.name} />
					<AvatarFallback className="text-[10px]">
						{getInitials(org.name)}
					</AvatarFallback>
				</Avatar>
			))}
			{organisers.length > 3 && (
				<AvatarGroupCount className="size-4 text-[10px]">
					+{organisers.length - 3}
				</AvatarGroupCount>
			)}
		</AvatarGroup>
	);

	return (
		<span className="flex items-center gap-1">
			{organisers.length > 1 ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<span>{avatarGroup}</span>
					</TooltipTrigger>
					<TooltipContent sideOffset={6}>{tooltipContent}</TooltipContent>
				</Tooltip>
			) : (
				avatarGroup
			)}
			{organisers.length === 1 && (
				<span className="text-xs font-bold truncate max-w-[160px]">
					{organisers[0].name}
				</span>
			)}
		</span>
	);
};

const ownerGroupRenderer: GroupValueRenderer = (_value, row) => {
	const leafRows = row.getLeafRows();
	const first = leafRows.length > 0 ? leafRows[0].original : row.original;
	const lead = first.compLead;
	if (!lead) {
		return <span className="text-muted-foreground">Unassigned</span>;
	}
	return <LeadsDisplay leads={[lead]} variant="summary" bold />;
};

const leadDelegateGroupRenderer: GroupValueRenderer = (_value, row) => {
	const leafRows = row.getLeafRows();
	const first = leafRows.length > 0 ? leafRows[0].original : row.original;
	const lead = first.leadDelegate;
	if (!lead) {
		return <span className="text-muted-foreground">Unassigned</span>;
	}
	return <LeadsDisplay leads={[lead]} variant="summary" bold />;
};

function getTasksSummary(comp: Competition): TasksSummary {
	const currentPhaseId = comp.phases[comp.currentPhaseIdx]?.id;
	const phaseTasks = currentPhaseId
		? comp.tasks.filter(
				(task: Competition["tasks"][number]) => task.phaseId === currentPhaseId,
			)
		: comp.tasks;
	const total = phaseTasks.length;
	const completed = phaseTasks.filter(
		(task: Competition["tasks"][number]) =>
			task.status === "done" || task.status === "cancelled",
	).length;
	const open = total - completed;
	return { completed, open, total };
}

function createSortableColumn(
	accessorKey: keyof Competition & string,
	headerLabel: string,
	cell: ColumnDef<Competition>["cell"],
	options: SortableColumnOptions = {},
): ColumnDef<Competition> {
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

export const columns: ColumnDef<Competition>[] = [
	createSortableColumn(
		"compStart",
		"Dates",
		({ row }) => {
			const start = row.original.compStart;
			const end = row.original.compEnd;
			return (
				<span className="text-xs text-muted-foreground">
					{formatDate(start)} – {formatDate(end)}
				</span>
			);
		},
		{
			meta: {
				groupValueRenderer: dateGroupRenderer,
			} satisfies ColumnDef<Competition>["meta"],
		},
	),
	createSortableColumn(
		"name",
		"Name",
		({ row }) => {
			const name = row.getValue<string>("name");
			return <span className="font-bold truncate">{name}</span>;
		},
		{
			meta: {
				groupValueRenderer: nameGroupRenderer,
			} satisfies ColumnDef<Competition>["meta"],
		},
	),
	{
		id: "phases",
		accessorFn: (row) => getCurrentPhaseKey(row),
		getGroupingValue: (row) => getCurrentPhaseKey(row),
		header: ({ column }) => (
			<SortableHeader column={column}>Phase</SortableHeader>
		),
		cell: ({ row }) => <EditablePhaseCell competition={row.original} />,
		enableSorting: true,
		sortingFn: (rowA, rowB) => {
			const a = getCurrentPhaseKey(rowA.original);
			const b = getCurrentPhaseKey(rowB.original);
			return String(a).localeCompare(String(b));
		},
		meta: {
			groupValueRenderer: phaseGroupRenderer,
		} satisfies ColumnDef<Competition>["meta"],
	},
	{
		id: "compLead",
		accessorFn: (row) => row.compLead?.name ?? "Unassigned",
		getGroupingValue: (row) => row.compLead?.id ?? "unassigned",
		header: ({ column }) => (
			<SortableHeader column={column}>Comp lead</SortableHeader>
		),
		cell: ({ row }) => <EditableCompLeadCell competition={row.original} />,
		enableSorting: true,
		meta: {
			groupValueRenderer: ownerGroupRenderer,
		} satisfies ColumnDef<Competition>["meta"],
	},
	{
		id: "leadDelegate",
		accessorFn: (row) => row.leadDelegate?.name ?? "Unassigned",
		getGroupingValue: (row) => row.leadDelegate?.id ?? "unassigned",
		header: ({ column }) => (
			<SortableHeader column={column}>Lead delegate</SortableHeader>
		),
		cell: ({ row }) => <EditableLeadDelegateCell competition={row.original} />,
		enableSorting: true,
		meta: {
			groupValueRenderer: leadDelegateGroupRenderer,
		} satisfies ColumnDef<Competition>["meta"],
	},
	{
		id: "organisers",
		accessorFn: (row) =>
			row.organisers.length > 0
				? row.organisers
						.map((u: Competition["organisers"][number]) => u.name)
						.sort((a: string, b: string) => a.localeCompare(b))
						.join(", ")
				: "No organisers",
		getGroupingValue: (row) =>
			row.organisers.length > 0
				? row.organisers
						.map((u: Competition["organisers"][number]) => u.id)
						.sort((a: string, b: string) => a.localeCompare(b))
						.join(",")
				: "none",
		header: "Organisers",
		cell: ({ row }) => <EditableOrganisersCell competition={row.original} />,
		enableSorting: true,
		meta: {
			groupValueRenderer: organisersGroupRenderer,
		} satisfies ColumnDef<Competition>["meta"],
	},
	{
		id: "tasks",
		accessorFn: (row) => getTasksSummary(row).completed,
		header: "Tasks",
		cell: ({ row }) => {
			const summary = getTasksSummary(row.original);
			return (
				<span className="font-mono text-xs">
					{summary.completed} / {summary.total}
				</span>
			);
		},
		meta: {
			groupValueRenderer: tasksGroupRenderer,
		} satisfies ColumnDef<Competition>["meta"],
		enableSorting: true,
	},
];
