import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type {
	Competition,
	CompetitionPhaseKey,
	Weekend,
} from "@/data/types-new";
import {
	getCalendarWeekendRowKey,
	type WeekendOverride,
} from "@/store/calendar-weekend-overrides-store";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
	getCurrentPhaseKey,
	getPhaseClass,
	getPhaseLabel,
} from "@/lib/competition-phase-config";
import { formatDate, getInitials } from "@/lib/format-utils";
import { cn, onMutationError } from "@/lib/utils";
import { LeadsDisplay } from "./leads-display";

function useSetWeekendOverride() {
	const mutate = useMutation(api.weekendOverrides.setOverride);
	return (satDate: string, patch: Partial<WeekendOverride>) => {
		void mutate({ satDate, ...patch }).catch(onMutationError);
	};
}

function getTasksSummary(comp: Competition): {
	completed: number;
	open: number;
	total: number;
} {
	const total = comp.tasks.length;
	const completed = comp.tasks.filter(
		(task) => task.status === "done" || task.status === "cancelled",
	).length;
	const open = total - completed;
	return { completed, open, total };
}

const emptyCell = <span className="text-muted-foreground text-xs">—</span>;

function NameCell({ weekend }: { weekend: Weekend }) {
	const setOverride = useSetWeekendOverride();
	const comp = weekend.competition;
	if (comp) {
		return <span className="font-bold truncate">{comp.name}</span>;
	}
	const rowKey = getCalendarWeekendRowKey(weekend.satDate, null);
	const eventNote = weekend.weekendInfo?.eventNote ?? "";
	return (
		<EditableNoteCell
			value={eventNote}
			onSubmit={(next) => setOverride(rowKey, { eventNote: next })}
			className="font-bold"
		/>
	);
}

function CompLeadCell({ weekend }: { weekend: Weekend }) {
	const setOverride = useSetWeekendOverride();
	const comp = weekend.competition;
	if (comp) {
		if (!comp.compLead) return emptyCell;
		return <LeadsDisplay leads={[comp.compLead]} variant="summary" bold />;
	}
	const rowKey = getCalendarWeekendRowKey(weekend.satDate, null);
	const reserved = weekend.weekendInfo?.reserved ?? false;
	return (
		<Badge
			variant={reserved ? "default" : "outline"}
			className="cursor-pointer hover:opacity-80"
			onClick={(e) => {
				e.stopPropagation();
				setOverride(rowKey, { reserved: !reserved });
			}}
		>
			Reserved
		</Badge>
	);
}

function LeadDelegateCell({ weekend }: { weekend: Weekend }) {
	const setOverride = useSetWeekendOverride();
	const comp = weekend.competition;
	if (comp) {
		if (!comp.leadDelegate) return emptyCell;
		return <LeadsDisplay leads={[comp.leadDelegate]} variant="summary" bold />;
	}
	const rowKey = getCalendarWeekendRowKey(weekend.satDate, null);
	const announced = weekend.weekendInfo?.announced ?? false;
	return (
		<Badge
			variant={announced ? "default" : "outline"}
			className="cursor-pointer hover:opacity-80"
			onClick={(e) => {
				e.stopPropagation();
				setOverride(rowKey, { announced: !announced });
			}}
		>
			Announced
		</Badge>
	);
}

function EditableNoteCell({
	value,
	onSubmit,
	className,
}: {
	value: string;
	onSubmit: (next: string) => void;
	className?: string;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(value);

	const handleCommit = () => {
		const trimmed = draft.trim();
		if (trimmed !== value) {
			onSubmit(trimmed);
		}
		setIsEditing(false);
	};

	if (isEditing) {
		return (
			<Input
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={handleCommit}
				onKeyDown={(e) => {
					e.stopPropagation();
					if (e.key === "Enter") handleCommit();
					if (e.key === "Escape") {
						setDraft(value);
						setIsEditing(false);
					}
				}}
				onClick={(e) => e.stopPropagation()}
				className={cn("h-6 text-sm", className)}
				autoFocus
			/>
		);
	}

	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				setDraft(value);
				setIsEditing(true);
			}}
			className={cn(
				"text-left text-sm w-full h-6 rounded px-2 -mx-2 hover:bg-muted/50 border border-transparent hover:border-input flex items-center",
				!value && "text-muted-foreground",
				className,
			)}
		>
			{value || ""}
		</button>
	);
}

export const calendarColumns: ColumnDef<Weekend>[] = [
	{
		accessorKey: "satDate",
		header: "Dates",
		cell: ({ row }) => {
			const w = row.original;
			const comp = w.competition;
			if (comp) {
				return (
					<span className="text-xs text-muted-foreground">
						{formatDate(comp.compStart)} – {formatDate(comp.compEnd)}
					</span>
				);
			}
			return (
				<span className="text-xs text-muted-foreground">
					{formatDate(w.satDate)} (no competition)
				</span>
			);
		},
	},
	{
		id: "name",
		accessorFn: (row) =>
			row.competition?.name ?? row.weekendInfo?.eventNote ?? "",
		header: "Name",
		cell: ({ row }) => <NameCell weekend={row.original} />,
	},
	{
		id: "phases",
		accessorFn: (row) =>
			row.competition ? getCurrentPhaseKey(row.competition) : null,
		header: "Phase",
		cell: ({ row }) => {
			const comp = row.original.competition;
			if (!comp) return emptyCell;
			const key = getCurrentPhaseKey(comp) as CompetitionPhaseKey;
			return <Badge className={getPhaseClass(key)}>{getPhaseLabel(key)}</Badge>;
		},
	},
	{
		id: "compLead",
		accessorFn: (row) => row.competition?.compLead?.name ?? "",
		header: "Comp lead",
		cell: ({ row }) => <CompLeadCell weekend={row.original} />,
	},
	{
		id: "leadDelegate",
		accessorFn: (row) => row.competition?.leadDelegate?.name ?? "",
		header: "Lead delegate",
		cell: ({ row }) => <LeadDelegateCell weekend={row.original} />,
	},
	{
		id: "organisers",
		accessorFn: (row) =>
			row.competition?.organisers
				?.map((u) => u.name)
				.sort((a, b) => a.localeCompare(b))
				.join(", ") ?? "",
		header: "Organisers",
		cell: ({ row }) => {
			const organisers = row.original.competition?.organisers ?? [];
			if (organisers.length === 0) return emptyCell;
			return (
				<span className="flex items-center gap-1">
					<AvatarGroup className="group-data-[size=sm]/avatar-group:*:data-[slot=avatar]:size-4">
						{organisers.slice(0, 3).map((org) => (
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
				</span>
			);
		},
	},
	{
		id: "tasks",
		accessorFn: (row) =>
			row.competition ? getTasksSummary(row.competition).completed : 0,
		header: "Tasks",
		cell: ({ row }) => {
			const comp = row.original.competition;
			if (!comp) return emptyCell;
			const summary = getTasksSummary(comp);
			return (
				<span className="font-mono text-xs">
					{summary.completed} / {summary.total}
				</span>
			);
		},
	},
];
