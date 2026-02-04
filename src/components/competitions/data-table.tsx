import { useRouter } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import {
	SharedDataTable,
	type SharedDataTableProps,
} from "@/components/shared/data-table";
import { useCompetitions } from "@/hooks/use-convex-data";
import type { Competition } from "@/data/types-new";
import { filterCompetitionsWithState } from "@/lib/competitions-filters";
import { useCompetitionsFilterStore } from "@/store/competitions-filter-store";
import { useDisplaySettingsStore } from "@/store/display-settings-store";

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
}

export function DataTable<TData, TValue>({
	columns,
}: DataTableProps<TData, TValue>) {
	const filters = useCompetitionsFilterStore((state) => state.filters);
	const matchMode = useCompetitionsFilterStore((state) => state.matchMode);
	const grouping = useDisplaySettingsStore((state) => state.grouping);
	const subGrouping = useDisplaySettingsStore((state) => state.subGrouping);
	const ordering = useDisplaySettingsStore((state) => state.ordering);
	const setOrdering = useDisplaySettingsStore((state) => state.setOrdering);
	const router = useRouter();
	const { competitions } = useCompetitions();

	const filterState = useMemo(
		() => ({ ...filters, matchMode }),
		[filters, matchMode],
	);

	const filterFn: SharedDataTableProps<
		Competition,
		typeof filterState
	>["filterFn"] = useMemo(
		() => (rows: Competition[], state: typeof filterState) =>
			filterCompetitionsWithState(rows, state),
		[],
	);

	return (
		<SharedDataTable<Competition, typeof filterState>
			columns={columns as ColumnDef<Competition, unknown>[]}
			data={competitions}
			filterState={filterState}
			filterFn={filterFn}
			grouping={grouping}
			subGrouping={subGrouping}
			ordering={ordering}
			setOrdering={setOrdering}
			containerClassName="px-4"
			emptyLabel="No results."
			onRowClick={(competition) =>
				router.navigate({
					to: "/competitions/$id",
					params: { id: competition.id },
				})
			}
		/>
	);
}
