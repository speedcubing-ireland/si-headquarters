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
import { useEffect, useMemo } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ColumnMeta<TData> = {
	headerClassName?: string;
	cellClassName?: string;
	groupValueRenderer?: (value: unknown, row: Row<TData>) => React.ReactNode;
};

export interface SharedDataTableProps<TData, TValue, TFilterState> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	filterState: TFilterState;
	filterFn: (rows: TData[], filterState: TFilterState) => TData[];
	grouping: string | null;
	subGrouping: string | null;
	ordering: {
		field: string | null;
		direction: "asc" | "desc";
	};
	setOrdering: (field: string | null, direction: "asc" | "desc") => void;
	emptyLabel?: string;
}

export function SharedDataTable<TData, TValue, TFilterState>({
	columns,
	data,
	filterState,
	filterFn,
	grouping,
	subGrouping,
	ordering,
	setOrdering,
	emptyLabel = "No results.",
	onRowClick,
}: SharedDataTableProps<TData, TValue, TFilterState> & {
	onRowClick?: (row: TData) => void;
}) {
	const filteredData = useMemo(
		() => filterFn(data, filterState),
		[data, filterState, filterFn],
	);

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

	const table = useReactTable({
		data: filteredData,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getGroupedRowModel: getGroupedRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		groupedColumnMode: false,
		initialState: {
			expanded: true,
		},
		state: {
			grouping: groupingState,
			sorting: sortingState,
		},
		onSortingChange: (updater) => {
			const nextSorting =
				typeof updater === "function" ? updater(sortingState) : updater;
			if (nextSorting && nextSorting.length > 0) {
				const sort = nextSorting[0];
				setOrdering(sort.id, sort.desc ? "desc" : "asc");
			} else {
				setOrdering(null, "asc");
			}
		},
	});

	// When grouping changes, re-expand all groups so the user sees the full breakdown.
	useEffect(() => {
		if (groupingState.length > 0) {
			table.setExpanded(true);
		}
	}, [groupingState, table]);

	return (
		<div className="w-full">
			<Table>
				<TableHeader className="bg-background sticky top-0 z-0 border-b">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id} className="border-b">
							{headerGroup.headers.map((header) => {
								const meta =
									(header.column.columnDef.meta as
										| ColumnMeta<TData>
										| undefined) ?? undefined;
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
								{emptyLabel}
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
							const isClickable = !!onRowClick && !isGrouped;

							const isInteractiveTarget = (target: HTMLElement | null) => {
								if (!target) return false;
								
								// Check for standard interactive elements
								if (
									target.closest(
										"button,[role=button],a[href],input,select,textarea,[contenteditable=true]",
									)
								) {
									return true;
								}
								
								// Check for dropdown/select/command menu items and their containers
								// These use Radix UI with data-slot attributes and portals
								if (
									target.closest(
										'[data-slot="dropdown-menu-content"],[data-slot="dropdown-menu-item"],[data-slot="select-content"],[data-slot="select-item"],[data-slot="command"],[data-slot="command-item"]',
									)
								) {
									return true;
								}
								
								// Check for elements with menu-related roles
								if (
									target.closest(
										'[role="menuitem"],[role="option"],[role="combobox"],[role="listbox"]',
									)
								) {
									return true;
								}
								
								// Check if element is inside a Radix Portal (dropdowns/selects render in portals)
								if (target.closest('[data-radix-portal]')) {
									return true;
								}
								
								return false;
							};

							const cellContainsInteractiveElements = (
								cellElement: HTMLElement | null,
							) => {
								if (!cellElement) return false;
								
								// Check if the cell contains any interactive elements
								const interactiveSelector =
									"button,[role=button],a[href],input,select,textarea,[contenteditable=true],[data-slot='dropdown-menu-trigger'],[data-slot='select-trigger'],[data-slot='command']";
								
								return !!cellElement.querySelector(interactiveSelector);
							};

							return (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
									className={cn(
										"border-b border-muted-foreground/5 transition-colors",
										isGrouped &&
											"bg-muted/30 border-muted-foreground/10 cursor-pointer hover:bg-muted/50",
										!isGrouped &&
											isClickable &&
											"cursor-pointer hover:bg-sidebar/50",
									)}
									onClick={(e) => {
										if (isGrouped) {
											e.stopPropagation();
											row.toggleExpanded();
											return;
										}

										if (!onRowClick) return;
										const target = e.target as HTMLElement | null;
										
										// Check if the click target itself is interactive
										if (isInteractiveTarget(target)) return;
										
										// Check if the clicked cell contains interactive elements
										// Find the closest table cell (td) element
										const clickedCell = target?.closest("td");
										if (clickedCell && cellContainsInteractiveElements(clickedCell)) {
											return;
										}

										onRowClick(row.original as TData);
									}}
								>
									{row.getVisibleCells().map((cell, _index, allCells) => {
										const meta =
											(cell.column.columnDef.meta as
												| ColumnMeta<TData>
												| undefined) ?? undefined;
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
																(
																	row as Row<TData> & {
																		groupingColumnId?: string;
																	}
																).groupingColumnId || cell.column.id;
															const value = row.getGroupingValue(groupId);
															const groupColumn = table.getColumn(
																groupId as string,
															);
															const groupMeta = groupColumn?.columnDef.meta as
																| ColumnMeta<TData>
																| undefined;
															const renderer = groupMeta?.groupValueRenderer;

															return renderer ? (
																renderer(value, row as Row<TData>)
															) : value != null ? (
																<span>{String(value)}</span>
															) : null;
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
