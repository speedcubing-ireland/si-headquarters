import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getExpandedRowModel,
	getGroupedRowModel,
	getSortedRowModel,
	type Row,
	useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useData } from "@/data/data-store";
import { filterCompetitionsWithState } from "@/lib/competitions-filters";
import { cn } from "@/lib/utils";
import { useCompetitionsFilterStore } from "@/store/competitions-filter-store";
import { useDisplaySettingsStore } from "@/store/display-settings-store";

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data?: TData[];
}

type ColumnMeta<TData> = {
	headerClassName?: string;
	cellClassName?: string;
	groupValueRenderer?: (value: unknown, row: Row<TData>) => React.ReactNode;
};

// Component to render grouped rows
export function DataTable<TData, TValue>({
	columns,
}: DataTableProps<TData, TValue>) {
	const { filters, matchMode } = useCompetitionsFilterStore();
	const { grouping, subGrouping, ordering, setOrdering } =
		useDisplaySettingsStore();
	const competitions = useData((state) => state.competitions) as TData[];

	// Compute filtered data via pure helper to avoid calling store actions in selectors
	const filteredData = useMemo(() => {
		// The competitions store is currently specialized to Project[],
		// but DataTable is generic. We cast through Project[] here
		// to reuse the shared filtering helper while keeping the
		// external API generic.
		return filterCompetitionsWithState(
			competitions as unknown as Project[],
			{ ...filters, matchMode },
		) as TData[];
	}, [competitions, filters, matchMode]);

	// Build grouping array
	const groupingState = useMemo(() => {
		const groups: string[] = [];
		if (grouping) groups.push(grouping);
		if (subGrouping && subGrouping !== grouping) groups.push(subGrouping);
		return groups;
	}, [grouping, subGrouping]);

	const sortingState = useMemo(() => {
		if (ordering.field) {
			return [{ id: ordering.field, desc: ordering.direction === "desc" }];
		}
		if (groupingState.length > 0) {
			return [{ id: groupingState[0], desc: false }];
		}
		return [];
	}, [ordering, groupingState]);

	// Expansion state - all groups expanded by default
	const [expanded, setExpanded] = useState<Record<string, boolean> | true>(
		true,
	);

	const table = useReactTable({
		data: filteredData,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getGroupedRowModel: getGroupedRowModel(),
		getSortedRowModel: getSortedRowModel(),
		// Note: getExpandedRowModel is not in the chain - we handle expansion manually
		// but we still need it configured for expansion state to work
		getExpandedRowModel: getExpandedRowModel(),
		// Keep grouped columns in their original position instead of moving them to the start
		groupedColumnMode: false,
		state: {
			grouping: groupingState,
			sorting: sortingState,
			expanded,
		},
		onSortingChange: (updater) => {
			const nextSorting =
				typeof updater === "function" ? updater(sortingState) : updater;
			// Update display settings store with new sorting
			if (nextSorting && nextSorting.length > 0) {
				const sort = nextSorting[0];
				setOrdering(sort.id, sort.desc ? "desc" : "asc");
			} else {
				setOrdering(null, "asc");
			}
		},
		onExpandedChange: (updater) => {
			setExpanded((prev) => {
				const next = typeof updater === "function" ? updater(prev) : updater;
				// Handle case where TanStack Table might return true (all expanded) or false (all collapsed)
				if (typeof next === "boolean") {
					return next ? true : {};
				}
				return next;
			});
		},
	});

	return (
		<div className="w-full overflow-auto">
			<Table>
				<TableHeader className="bg-background sticky top-0 z-10">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id} className="border-b">
							{headerGroup.headers.map((header) => {
								const meta =
									(header.column.columnDef
										.meta as ColumnMeta<TData> | undefined) ?? undefined;
								return (
									<TableHead
										key={header.id}
										className={cn(
											"px-6 py-1.5 text-sm text-muted-foreground font-medium text-left",
											meta?.headerClassName,
										)}
										aria-sort={
											header.column.getIsSorted() === "asc"
												? "ascending"
												: header.column.getIsSorted() === "desc"
													? "descending"
													: undefined
										}
									>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								);
							})}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.length === 0 ? (
						<TableRow>
							<TableCell
								colSpan={columns.length}
								className="h-24 text-center text-muted-foreground"
							>
								No results.
							</TableCell>
						</TableRow>
					) : (
						table.getRowModel().rows.map((row) => {
							const leafRows = row.getLeafRows();
							const actualDataRows = leafRows.filter(
								(leafRow) => !leafRow.getIsGrouped(),
							);
							const leafCount = actualDataRows.length;
							const isGrouped = row.getIsGrouped();
							const isExpanded = row.getIsExpanded();
							const depth = row.depth ?? 0;

							return (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
									className={cn(
										"border-b border-muted-foreground/5 hover:bg-sidebar/50 transition-colors",
										isGrouped &&
											"bg-muted/30 border-muted-foreground/10 cursor-pointer hover:bg-muted/50",
									)}
									onClick={(e) => {
										if (!isGrouped) return;
										e.stopPropagation();
										row.toggleExpanded();
									}}
								>
									{row.getVisibleCells().map((cell, _index, allCells) => {
										const meta =
											(cell.column.columnDef
												.meta as ColumnMeta<TData> | undefined) ?? undefined;
										const isFirstCell =
											cell.column.id === allCells[0]?.column.id;

										if (isGrouped && !isFirstCell) {
											return (
												<TableCell
													key={cell.id}
													className={cn(
														"px-6 py-2 text-sm font-medium",
														meta?.cellClassName,
													)}
												/>
											);
										}

										return (
											<TableCell
												key={cell.id}
												className={cn(
													"px-6 py-3 text-sm align-middle text-left",
													meta?.cellClassName,
													isFirstCell && depth > 0 && "pl-12",
												)}
											>
												{isGrouped && isFirstCell ? (
													<div className="flex items-center gap-2">
														{isExpanded ? (
															<ChevronDown className="size-4 text-muted-foreground/60" />
														) : (
															<ChevronRight className="size-4 text-muted-foreground/60" />
														)}
														{(() => {
															const groupId =
																(row as Row<TData> & {
																	groupingColumnId?: string;
																}).groupingColumnId ||
																cell.column.id;
															const value = row.getGroupingValue(groupId);
															const groupColumn =
																table.getColumn(groupId as string);
															const groupMeta = groupColumn?.columnDef
																.meta as ColumnMeta<TData> | undefined;
															const renderer = groupMeta?.groupValueRenderer;

															return renderer
																? renderer(value, row as Row<TData>)
																: value != null
																	? (
																			<span>{String(value)}</span>
																		)
																	: null;
														})()}
														<span className="text-muted-foreground text-sm ml-1">
															{leafCount}
														</span>
													</div>
												) : (
													flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)
												)}
											</TableCell>
										);
									})}
								</TableRow>
							);
						})
					)}
				</TableBody>
			</Table>
		</div>
	);
}
