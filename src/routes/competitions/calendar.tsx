import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Calendar, Loader2, Plus } from "lucide-react";
import { calendarColumns } from "@/components/competitions/calendar-columns";
import { SharedPageHeader } from "@/components/shared/page-header";
import {
	buildCalendarWeekends,
	mergeWeekendsWithOverrides,
} from "@/data/calendar-weekends";
import { useCompetitions } from "@/hooks/use-convex-data";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo, useState } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result";

export const Route = createFileRoute("/competitions/calendar")({
	component: CompetitionsCalendarPage,
});

function CompetitionsCalendarPage() {
	const { competitions, isLoading: competitionsLoading } = useCompetitions();
	const overridesListResult = useQuery(api.competitions.weekendOverrides.list);
	const overridesState = useRetainedQueryResult(overridesListResult);
	const overridesList = overridesState.data;
	const overrides = useMemo(() => {
		if (!overridesList) return {};
		return Object.fromEntries(
			overridesList.map((o) => [
				o.satDate,
				{
					eventNote: o.eventNote,
					reserved: o.reserved,
					announced: o.announced,
				},
			]),
		);
	}, [overridesList]);
	const weekends = useMemo(
		() => buildCalendarWeekends(competitions),
		[competitions],
	);
	const weekendsWithOverrides = useMemo(
		() => mergeWeekendsWithOverrides(weekends, overrides),
		[weekends, overrides],
	);
	const [ordering, setOrdering] = useState<{
		field: string | null;
		direction: "asc" | "desc";
	}>({ field: "satDate", direction: "asc" });
	const router = useRouter();

	const table = useReactTable({
		data: weekendsWithOverrides,
		columns: calendarColumns,
		getCoreRowModel: getCoreRowModel(),
		state: {
			sorting: ordering.field
				? [{ id: ordering.field, desc: ordering.direction === "desc" }]
				: [],
		},
		onSortingChange: (updater) => {
			const next =
				typeof updater === "function"
					? updater([
							{
								id: ordering.field ?? "satDate",
								desc: ordering.direction === "desc",
							},
						])
					: [];
			if (next.length > 0) {
				setOrdering({
					field: next[0].id,
					direction: next[0].desc ? "desc" : "asc",
				});
			} else {
				setOrdering({ field: "satDate", direction: "asc" });
			}
		},
	});

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col">
			<SharedPageHeader
				primaryIcon={Calendar}
				primaryLabel="Competitions calendar"
				onPrimaryClick={() => router.navigate({ to: "/competitions" })}
				addIcon={Plus}
				addLabel="Add competition"
				onAdd={() => router.navigate({ to: "/competitions" })}
			/>
			<div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										className="px-2 py-1 text-xs text-muted-foreground font-medium text-left"
									>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={calendarColumns.length}
									className="h-24 text-center text-muted-foreground"
								>
									{competitionsLoading || overridesState.isLoading ? (
										<span className="inline-flex items-center gap-2">
											<Loader2 className="size-4 animate-spin" />
											Loading calendar...
										</span>
									) : (
										"No weekends in range."
									)}
								</TableCell>
							</TableRow>
						) : (
							table.getRowModel().rows.map((row) => {
								const weekend = row.original;
								const isClickable = !!weekend.competition;
								const isNonComp = !weekend.competition;
								return (
									<TableRow
										key={row.id}
										className={cn(
											"border-b border-border/50 transition-colors h-10",
											isClickable && "cursor-pointer hover:bg-muted/30",
											isNonComp && "bg-muted/40",
										)}
										onClick={(e: React.MouseEvent<HTMLTableRowElement>) => {
											if (
												(e.target as HTMLElement).closest(
													"[data-calendar-notes-cell]",
												)
											) {
												return;
											}
											if (weekend.competition) {
												router.navigate({
													to: "/competitions/$id",
													params: { id: weekend.competition.id },
												});
											}
										}}
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell
												key={cell.id}
												className="px-2 py-2 text-sm align-middle text-left"
											>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
