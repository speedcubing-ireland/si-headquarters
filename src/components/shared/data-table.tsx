import {
	flexRender,
	getCoreRowModel,
	getExpandedRowModel,
	getGroupedRowModel,
	getSortedRowModel,
	useReactTable,
	type CellContext,
	type ColumnDef,
	type ExpandedState,
	type Row,
	type Table as TanStackTable,
} from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Table as TableUI,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type React from "react";
import {
	createContext,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useContext,
} from "react";
import {
	cellContainsInteractiveElements,
	isInteractiveTarget,
} from "@/lib/dom-utils";

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
	rowSelection?: Record<string, boolean>;
	onRowSelectionChange?: (updater: Record<string, boolean>) => void;
	autoHideRowSelection?: boolean;
}

export interface DataTableSelectionConfig<TData> {
	autoHide?: boolean;
	rowSelection?: Record<string, boolean>;
	onRowSelectionChange?: (updater: Record<string, boolean>) => void;
	onSelectionChange?: (selectedRows: TData[]) => void;
}

export interface DataTableProviderProps<TData, TFilterState> {
	columns: ColumnDef<TData, unknown>[];
	data: TData[];
	filterState: TFilterState;
	filterFn: (rows: TData[], filterState: TFilterState) => TData[];
	grouping: string | null;
	subGrouping: string | null;
	ordering: { field: string | null; direction: "asc" | "desc" };
	setOrdering: (field: string | null, direction: "asc" | "desc") => void;
	emptyLabel?: string;
	containerClassName?: string;
	cellPaddingXClassName?: string;
	onRowClick?: (row: TData) => void;
	getRowId?: (row: TData) => string;
	selection?: DataTableSelectionConfig<TData>;
	children: React.ReactNode;
}

interface DataTableState<TData> {
	filteredData: TData[];
	table: TanStackTable<TData>;
	tableColumns: ColumnDef<TData, unknown>[];
	emptyLabel: string;
	cellPaddingXClassName: string;
	onRowClick?: (row: TData) => void;
	containerRef: React.RefObject<HTMLDivElement | null>;
}

interface DataTableActions {
	updateRowSelection: (
		updater:
			| Record<string, boolean>
			| ((prev: Record<string, boolean>) => Record<string, boolean>),
	) => void;
}

interface DataTableMeta<TData> {
	getRowId?: (row: TData) => string;
	selectionEnabled: boolean;
	autoHideRowSelection: boolean;
	lastSelectedRowRef: React.MutableRefObject<Row<TData> | null>;
}

interface DataTableContextValue<TData> {
	state: DataTableState<TData>;
	actions: DataTableActions;
	meta: DataTableMeta<TData>;
}

const DataTableContext = createContext<DataTableContextValue<unknown> | null>(
	null,
);

function useDataTableContext<TData>() {
	const ctx = useContext(DataTableContext);
	if (!ctx)
		throw new Error(
			"DataTable compound components must be used within DataTable.Provider",
		);
	return ctx as DataTableContextValue<TData>;
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

function DataTableProviderInner<TData, TFilterState>({
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
	onRowClick,
	getRowId,
	selection,
	children,
}: DataTableProviderProps<TData, TFilterState>) {
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

	const selectionEnabled = !!selection;
	const isControlled = selection?.rowSelection !== undefined;
	const [internalRowSelection, setInternalRowSelection] = useState<
		Record<string, boolean>
	>({});
	const rowSelection = selectionEnabled
		? isControlled && selection?.rowSelection !== undefined
			? selection.rowSelection
			: internalRowSelection
		: {};

	const updateRowSelection = useCallback(
		(
			updater:
				| Record<string, boolean>
				| ((prev: Record<string, boolean>) => Record<string, boolean>),
		) => {
			if (!selectionEnabled) return;
			const newSelection =
				typeof updater === "function" ? updater(rowSelection) : updater;
			if (isControlled && selection?.onRowSelectionChange) {
				selection.onRowSelectionChange(newSelection);
			} else {
				setInternalRowSelection(newSelection);
			}
		},
		[
			selectionEnabled,
			isControlled,
			rowSelection,
			selection?.onRowSelectionChange,
		],
	);

	const lastSelectedRowRef = useRef<Row<TData> | null>(null);
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

	const tableInstanceRef = useRef<ReturnType<
		typeof useReactTable<TData>
	> | null>(null);

	const [expanded, setExpanded] = useState<ExpandedState>({});

	const tableColumns = useMemo(() => {
		if (!selectionEnabled) return columns;
		const sel = selection;
		const checkboxColumn: ColumnDef<TData, unknown> = {
			id: "selection",
			meta: {
				cellClassName: "pl-2",
			},
			header: ({ table }) => (
				<div
					className={cn(
						!sel?.autoHide || table.getIsSomePageRowsSelected()
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
				const showCheckbox = !sel?.autoHide || isSelected;
				return (
					<div
						className={cn(
							"flex h-full items-center justify-center",
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
	}, [columns, selectionEnabled, handleShiftClick, selection?.autoHide]);

	const table = useReactTable({
		data: filteredData,
		columns: tableColumns,
		getCoreRowModel: getCoreRowModel(),
		getGroupedRowModel: getGroupedRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		groupedColumnMode: false,
		getRowId: getRowId,
		enableRowSelection: selectionEnabled,
		getRowCanExpand: (row) => row.subRows.length > 0,
		state: {
			grouping: groupingState,
			sorting: sortingState,
			rowSelection: selectionEnabled ? rowSelection : {},
			expanded,
		},
		onExpandedChange: setExpanded,
		onSortingChange: (updater) => {
			const nextSorting =
				typeof updater === "function" ? updater(sortingState) : updater;
			if (nextSorting?.length) {
				const sort = nextSorting[0];
				setOrdering(sort.id, sort.desc ? "desc" : "asc");
			} else {
				setOrdering(null, "asc");
			}
		},
		onRowSelectionChange: (updater) => {
			if (!selectionEnabled) return;
			const newSelection =
				typeof updater === "function" ? updater(rowSelection) : updater;
			updateRowSelection(newSelection);
			const selectedIds = Object.entries(newSelection)
				.filter(([, sel]) => sel)
				.map(([id]) => id);
			const selectedRows = filteredData.filter((row) => {
				const rowId = getRowId?.(row);
				if (rowId !== undefined) return selectedIds.includes(rowId);
				return selectedIds.includes(String(filteredData.indexOf(row)));
			});
			selection?.onSelectionChange?.(selectedRows);
		},
	});

	tableInstanceRef.current = table;

	useEffect(() => {
		if (!selectionEnabled) return;
		const visibleRowIds = new Set(
			filteredData.map(
				(row) => getRowId?.(row) ?? String(filteredData.indexOf(row)),
			),
		);
		const newSelection: Record<string, boolean> = {};
		let hasChanges = false;
		for (const [id, selected] of Object.entries(rowSelection)) {
			if (selected && visibleRowIds.has(id)) newSelection[id] = true;
			else if (selected) hasChanges = true;
		}
		if (hasChanges) updateRowSelection(newSelection);
	}, [
		filteredData,
		selectionEnabled,
		rowSelection,
		getRowId,
		updateRowSelection,
	]);

	useEffect(() => {
		if (!selectionEnabled) return;
		const container = containerRef.current;
		if (!container) return;
		const handleSelectAll = () => table.toggleAllPageRowsSelected(true);
		container.addEventListener("datatable-select-all", handleSelectAll);
		return () =>
			container.removeEventListener("datatable-select-all", handleSelectAll);
	}, [selectionEnabled, table]);

	const value = useMemo<DataTableContextValue<TData>>(
		() => ({
			state: {
				filteredData,
				table,
				tableColumns,
				emptyLabel,
				cellPaddingXClassName,
				onRowClick,
				containerRef,
			},
			actions: { updateRowSelection },
			meta: {
				getRowId,
				selectionEnabled,
				autoHideRowSelection: selection?.autoHide ?? false,
				lastSelectedRowRef,
			},
		}),
		[
			filteredData,
			table,
			tableColumns,
			emptyLabel,
			cellPaddingXClassName,
			onRowClick,
			updateRowSelection,
			getRowId,
			selectionEnabled,
			selection?.autoHide,
			expanded,
		],
	);

	return (
		<DataTableContext.Provider value={value as DataTableContextValue<unknown>}>
			<div ref={containerRef} className={cn("w-full", containerClassName)}>
				{children}
			</div>
		</DataTableContext.Provider>
	);
}

function DataTableProvider<TData, TFilterState>(
	props: DataTableProviderProps<TData, TFilterState>,
) {
	return <DataTableProviderInner {...props} />;
}

function DataTableHeaderInner<TData>() {
	const { state } = useDataTableContext<TData>();
	const { table } = state;
	return (
		<TableHeader>
			{table.getHeaderGroups().map((headerGroup) => (
				<TableRow key={headerGroup.id}>
					{headerGroup.headers.map((header) => {
						const meta =
							(header.column.columnDef.meta as
								| {
										headerClassName?: string;
								  }
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
	);
}

function DataTableHeader<TData>() {
	return <DataTableHeaderInner<TData> />;
}

interface DataTableDataRowProps<TData = unknown> {
	row: Row<TData>;
	onRowClick?: (row: TData) => void;
	cellPaddingXClassName: string;
	table: TanStackTable<TData>;
	depth: number;
	columnCount: number;
}

function DataTableDataRow<TData = unknown>({
	row,
	onRowClick,
	cellPaddingXClassName,
	depth,
	columnCount,
}: DataTableDataRowProps<TData>) {
	const leafCount = row.subRows?.length ?? 0;
	const isGroupedRow = row.getIsGrouped();
	const isExpanded = row.getIsExpanded();
	const isClickable = !!onRowClick && !isGroupedRow;

	if (isGroupedRow) {
		const groupedCell = row.getVisibleCells().find((c) => c.getIsGrouped?.());
		const metaCell = groupedCell
			? ((groupedCell.column.columnDef.meta as
					| {
							groupValueRenderer?: (
								value: unknown,
								row: Row<TData>,
							) => React.ReactNode;
					  }
					| undefined) ?? undefined)
			: undefined;

		return (
			<TableRow
				data-state={row.getIsSelected() && "selected"}
				className={cn(
					"border-b border-border/50 transition-colors group",
					"bg-muted/20 border-border/30 cursor-pointer hover:bg-muted/40",
					row.getIsSelected() && "bg-muted/50",
				)}
				onClick={(e) => {
					e.stopPropagation();
					row.getToggleExpandedHandler()();
				}}
				role="button"
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						e.stopPropagation();
						row.getToggleExpandedHandler()();
					}
				}}
			>
				<TableCell
					colSpan={columnCount}
					className={cn(
						cellPaddingXClassName,
						"py-2 text-sm align-middle text-left",
					)}
				>
					<div className="flex items-center justify-between w-full pr-2">
						<div className="flex items-center gap-1.5">
							{isExpanded ? (
								<ChevronDown className="size-3.5 text-muted-foreground/50" />
							) : (
								<ChevronRight className="size-3.5 text-muted-foreground/50" />
							)}
							{groupedCell && metaCell?.groupValueRenderer ? (
								metaCell.groupValueRenderer(
									row.getGroupingValue(groupedCell.column.id),
									row as Row<TData>,
								)
							) : (
								<span className="font-semibold text-sm">
									{String(groupedCell?.getValue() ?? "")}
								</span>
							)}
							<span className="text-muted-foreground text-xs">{leafCount}</span>
						</div>
						<Plus className="size-4 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />
					</div>
				</TableCell>
			</TableRow>
		);
	}

	return (
		<TableRow
			data-state={row.getIsSelected() && "selected"}
			className={cn(
				"border-b border-border/50 transition-colors group",
				isClickable && "cursor-pointer hover:bg-muted/30",
				"h-10",
				row.getIsSelected() && "bg-muted/50",
			)}
			onClick={(e) => {
				const target = e.target as HTMLElement | null;
				if (isInteractiveTarget(target)) return;
				const clickedCell = target?.closest("td");
				if (clickedCell && cellContainsInteractiveElements(clickedCell)) return;
				if (!onRowClick) return;
				onRowClick(row.original as TData);
			}}
		>
			{row.getVisibleCells().map((cell) => {
				const metaCell =
					(cell.column.columnDef.meta as
						| {
								cellClassName?: string;
						  }
						| undefined) ?? undefined;

				const isAggregated = cell.getIsAggregated?.() ?? false;
				const isPlaceholder = cell.getIsPlaceholder?.() ?? false;

				if (isPlaceholder) {
					return null;
				}

				return (
					<TableCell
						key={cell.id}
						className={cn(
							cellPaddingXClassName,
							"py-2 text-sm align-middle text-left",
							metaCell?.cellClassName,
							depth > 0 &&
								cell.column.id === row.getVisibleCells()[0]?.column.id &&
								"pl-10",
						)}
					>
						{isAggregated
							? flexRender(
									cell.column.columnDef.aggregatedCell ??
										cell.column.columnDef.cell,
									cell.getContext(),
								)
							: flexRender(cell.column.columnDef.cell, cell.getContext())}
					</TableCell>
				);
			})}
		</TableRow>
	);
}

function DataTableBodyInner<TData>() {
	const { state } = useDataTableContext<TData>();
	const { table, tableColumns, emptyLabel, cellPaddingXClassName, onRowClick } =
		state;

	if (table.getRowModel().rows.length === 0) {
		return (
			<TableBody>
				<TableRow>
					<TableCell
						colSpan={tableColumns.length}
						className="h-24 text-center text-muted-foreground"
					>
						{emptyLabel}
					</TableCell>
				</TableRow>
			</TableBody>
		);
	}

	return (
		<TableBody>
			{table.getRowModel().rows.map((rowModel) => (
				<DataTableDataRow
					key={rowModel.id}
					row={rowModel as Row<unknown>}
					onRowClick={onRowClick as ((row: unknown) => void) | undefined}
					cellPaddingXClassName={cellPaddingXClassName}
					table={table as TanStackTable<unknown>}
					depth={rowModel.depth ?? 0}
					columnCount={tableColumns.length}
				/>
			))}
		</TableBody>
	);
}

function DataTableBody<TData>() {
	return <DataTableBodyInner<TData> />;
}

function DataTableRowSelection() {
	return null;
}

const DataTable = {
	Provider: DataTableProvider,
	Header: DataTableHeader,
	Body: DataTableBody,
	RowSelection: DataTableRowSelection,
};

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
	const selection: DataTableSelectionConfig<TData> | undefined =
		enableRowSelection
			? {
					autoHide: autoHideRowSelection,
					rowSelection: controlledRowSelection,
					onRowSelectionChange: controlledOnRowSelectionChange,
					onSelectionChange: onSelectionChange,
				}
			: undefined;

	return (
		<DataTable.Provider
			columns={columns}
			data={data}
			filterState={filterState}
			filterFn={filterFn}
			grouping={grouping}
			subGrouping={subGrouping}
			ordering={ordering}
			setOrdering={setOrdering}
			emptyLabel={emptyLabel}
			containerClassName={containerClassName}
			cellPaddingXClassName={cellPaddingXClassName}
			onRowClick={onRowClick}
			getRowId={getRowId}
			selection={selection}
		>
			<TableUI>
				{showHeader ? (
					<>
						<DataTable.Header />
						<DataTable.Body />
					</>
				) : (
					<DataTable.Body />
				)}
			</TableUI>
		</DataTable.Provider>
	);
}
