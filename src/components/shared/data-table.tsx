import {
	flexRender,
	getCoreRowModel,
	getExpandedRowModel,
	getGroupedRowModel,
	getSortedRowModel,
	useReactTable,
	type CellContext,
	type ColumnDef,
	type Row,
} from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	cellContainsInteractiveElements,
	isInteractiveTarget,
} from "@/lib/dom-utils";

export type ColumnMeta<TData> = {
	headerClassName?: string;
	cellClassName?: string;
	groupValueRenderer?: (value: unknown, row: Row<TData>) => React.ReactNode;
};

export interface SharedDataTableProps<TData, TFilterState> {
	columns: ColumnDef<TData, unknown>[];
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
	containerClassName?: string;
	cellPaddingXClassName?: string;
	showHeader?: boolean;
	onRowClick?: (row: TData) => void;
	enableRowSelection?: boolean;
	onSelectionChange?: (selectedRows: TData[]) => void;
	getRowId?: (row: TData) => string;
	/** Controlled row selection state. When provided, component operates in controlled mode. */
	rowSelection?: Record<string, boolean>;
	/** Callback when row selection changes (for controlled mode). */
	onRowSelectionChange?: (updater: Record<string, boolean>) => void;
	/** When true, checkboxes are hidden until row is hovered or any row is selected */
	autoHideRowSelection?: boolean;
}

function RowSelectionCheckbox<TData>({
	row,
	onShiftClick,
	lastSelectedRowRef,
}: {
	row: Row<TData>;
	onShiftClick?: (row: Row<TData>) => void;
	lastSelectedRowRef: React.MutableRefObject<Row<TData> | null>;
}) {
	return (
		<Checkbox
			checked={row.getIsSelected()}
			onCheckedChange={(value) => {
				if (value) {
					row.toggleSelected(true);
					lastSelectedRowRef.current = row;
				} else {
					row.toggleSelected(false);
				}
			}}
			onClick={(e) => {
				e.stopPropagation();
				if (e.shiftKey && lastSelectedRowRef.current && onShiftClick) {
					onShiftClick(row);
				}
			}}
			aria-label="Select row"
		/>
	);
}

export function SharedDataTable<TData, TFilterState>({
	columns,
	data,
	filterState,
	filterFn,
	grouping,
	subGrouping,
	ordering,
	setOrdering,
	emptyLabel = "No results.",
	containerClassName,
	cellPaddingXClassName = "px-2",
	showHeader = true,
	onRowClick,
	enableRowSelection = false,
	onSelectionChange,
	getRowId,
	rowSelection: controlledRowSelection,
	onRowSelectionChange: controlledOnRowSelectionChange,
	autoHideRowSelection = false,
}: SharedDataTableProps<TData, TFilterState>) {
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

	// Use controlled row selection if provided, otherwise internal state
	const isControlled = controlledRowSelection !== undefined;
	const [internalRowSelection, setInternalRowSelection] = useState<
		Record<string, boolean>
	>({});
	const rowSelection = isControlled
		? controlledRowSelection
		: internalRowSelection;

	// Helper to update row selection (handles both controlled and uncontrolled modes)
	const updateRowSelection = useCallback(
		(
			updater:
				| Record<string, boolean>
				| ((prev: Record<string, boolean>) => Record<string, boolean>),
		) => {
			const newSelection =
				typeof updater === "function" ? updater(rowSelection) : updater;
			if (isControlled) {
				controlledOnRowSelectionChange?.(newSelection);
			} else {
				setInternalRowSelection(newSelection);
			}
		},
		[isControlled, controlledOnRowSelectionChange, rowSelection],
	);

	const lastSelectedRowRef = useRef<Row<TData> | null>(null);
	const tableInstanceRef = useRef<ReturnType<
		typeof useReactTable<TData>
	> | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const getRowIdRef = useRef(getRowId);
	getRowIdRef.current = getRowId;

	const handleShiftClick = useCallback(
		(clickedRow: Row<TData>) => {
			const lastRow = lastSelectedRowRef.current;
			if (!lastRow || !tableInstanceRef.current) return;

			const allRows = tableInstanceRef.current.getRowModel().rows;
			const lastIndex = allRows.findIndex((r) => r.id === lastRow.id);
			const clickedIndex = allRows.findIndex((r) => r.id === clickedRow.id);

			if (lastIndex === -1 || clickedIndex === -1) return;

			const startIndex = Math.min(lastIndex, clickedIndex);
			const endIndex = Math.max(lastIndex, clickedIndex);

			const newSelection = { ...rowSelection };
			for (let i = startIndex; i <= endIndex; i++) {
				const row = allRows[i];
				if (row && getRowIdRef.current) {
					newSelection[getRowIdRef.current(row.original as TData)] = true;
				} else if (row) {
					newSelection[row.id] = true;
				}
			}
			updateRowSelection(newSelection);
		},
		[rowSelection, updateRowSelection],
	);

	const tableColumns = useMemo(() => {
		if (!enableRowSelection) return columns;

		const checkboxColumn: ColumnDef<TData, unknown> = {
			id: "selection",
			header: ({ table }) => (
				<div
					className={cn(
						!autoHideRowSelection || table.getIsSomePageRowsSelected()
							? "opacity-100"
							: "opacity-0",
					)}
				>
					<Checkbox
						checked={
							table.getIsAllPageRowsSelected() ||
							(table.getIsSomePageRowsSelected() && "indeterminate")
						}
						onCheckedChange={(value) =>
							table.toggleAllPageRowsSelected(!!value)
						}
						aria-label="Select all"
					/>
				</div>
			),
			cell: ({ row }: CellContext<TData, unknown>) => {
				const isSelected = row.getIsSelected();
				// Each checkbox only shows if: auto-hide disabled, OR this row is selected, OR this row is hovered
				const showCheckbox = !autoHideRowSelection || isSelected;
				return (
					<div
						className={cn(
							showCheckbox
								? "opacity-100"
								: "opacity-0 group-hover:opacity-100",
						)}
					>
						<RowSelectionCheckbox
							row={row as Row<TData>}
							onShiftClick={handleShiftClick}
							lastSelectedRowRef={lastSelectedRowRef}
						/>
					</div>
				);
			},
			enableSorting: false,
			enableHiding: false,
			size: 32,
		};

		return [checkboxColumn, ...columns];
	}, [columns, enableRowSelection, handleShiftClick, autoHideRowSelection]);

	const table = useReactTable({
		data: filteredData,
		columns: tableColumns,
		getCoreRowModel: getCoreRowModel(),
		getGroupedRowModel: getGroupedRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		groupedColumnMode: false,
		getRowId: getRowId,
		enableRowSelection: enableRowSelection,
		initialState: {
			expanded: true,
		},
		state: {
			grouping: groupingState,
			sorting: sortingState,
			rowSelection: enableRowSelection ? rowSelection : {},
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
		onRowSelectionChange: (updater) => {
			if (!enableRowSelection) return;
			const newSelection =
				typeof updater === "function" ? updater(rowSelection) : updater;
			updateRowSelection(newSelection);

			// Calculate and sync selected row data
			// We need to create a temporary table with the new selection to get the selected rows
			const selectedIds = Object.entries(newSelection)
				.filter(([, selected]) => selected)
				.map(([id]) => id);
			const selectedRows = filteredData.filter((row) => {
				const rowId = getRowId ? getRowId(row) : undefined;
				if (rowId !== undefined) {
					return selectedIds.includes(rowId);
				}
				// Fallback: use index-based id that TanStack uses by default
				const index = filteredData.indexOf(row);
				return selectedIds.includes(String(index));
			});
			onSelectionChange?.(selectedRows);
		},
	});

	tableInstanceRef.current = table;

	// Auto-deselect rows that are no longer visible in filtered data
	useEffect(() => {
		if (!enableRowSelection) return;

		// Get IDs of currently visible rows
		const visibleRowIds = new Set(
			filteredData.map(
				(row) => getRowId?.(row) ?? String(filteredData.indexOf(row)),
			),
		);

		// Remove selections for rows no longer visible
		const newSelection: Record<string, boolean> = {};
		let hasChanges = false;

		for (const [id, selected] of Object.entries(rowSelection)) {
			if (selected && visibleRowIds.has(id)) {
				newSelection[id] = true;
			} else if (selected) {
				hasChanges = true; // Row was selected but is no longer visible
			}
		}

		if (hasChanges) {
			updateRowSelection(newSelection);
		}
	}, [
		filteredData,
		enableRowSelection,
		rowSelection,
		getRowId,
		updateRowSelection,
	]);

	useEffect(() => {
		if (groupingState.length > 0) {
			table.setExpanded(true);
		}
	}, [groupingState, table]);

	// Handle Cmd/Ctrl+A select all event
	useEffect(() => {
		if (!enableRowSelection) return;

		const container = containerRef.current;
		if (!container) return;

		const handleSelectAll = () => {
			table.toggleAllPageRowsSelected(true);
		};

		container.addEventListener("datatable-select-all", handleSelectAll);
		return () => {
			container.removeEventListener("datatable-select-all", handleSelectAll);
		};
	}, [enableRowSelection, table]);

	return (
		<div ref={containerRef} className={cn("w-full", containerClassName)}>
			<Table>
				{showHeader ? (
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									const meta =
										(header.column.columnDef.meta as
											| ColumnMeta<TData>
											| undefined) ?? undefined;
									return (
										<TableHead
											key={header.id}
											className={cn(
												"px-2 py-1 text-xs text-muted-foreground font-medium text-left",
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
				) : null}
				<TableBody>
					{table.getRowModel().rows.length === 0 ? (
						<TableRow>
							<TableCell
								colSpan={tableColumns.length}
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

							return (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
									className={cn(
										"border-b border-border/50 transition-colors group",
										isGrouped &&
											"bg-muted/20 border-border/30 cursor-pointer hover:bg-muted/40",
										!isGrouped &&
											isClickable &&
											"cursor-pointer hover:bg-muted/30",
										!isGrouped && "h-10",
										row.getIsSelected() && "bg-muted/50",
									)}
									onClick={(e) => {
										if (isGrouped) {
											e.stopPropagation();
											row.toggleExpanded();
											return;
										}

										if (!onRowClick) return;
										const target = e.target as HTMLElement | null;

										if (isInteractiveTarget(target)) return;

										const clickedCell = target?.closest("td");
										if (
											clickedCell &&
											cellContainsInteractiveElements(clickedCell)
										) {
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
											return null;
										}

										if (isGrouped && isFirstCell) {
											return (
												<TableCell
													key={cell.id}
													colSpan={allCells.length}
													className={cn(cellPaddingXClassName, "py-2 text-sm")}
												>
													<div className="flex items-center justify-between w-full pr-2">
														<div className="flex items-center gap-1.5">
															{isExpanded ? (
																<ChevronDown className="size-3.5 text-muted-foreground/50" />
															) : (
																<ChevronRight className="size-3.5 text-muted-foreground/50" />
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
																	<span className="font-semibold text-sm">
																		{String(value)}
																	</span>
																) : null;
															})()}
															<span className="text-muted-foreground text-xs">
																{leafCount}
															</span>
														</div>
														<Plus className="size-4 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />
													</div>
												</TableCell>
											);
										}

										return (
											<TableCell
												key={cell.id}
												className={cn(
													cellPaddingXClassName,
													"py-2 text-sm align-middle text-left",
													meta?.cellClassName,
													isFirstCell && depth > 0 && "pl-10",
												)}
											>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
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
