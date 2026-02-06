import { useRouter } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useCallback } from "react";
import {
	SharedDataTable,
	type SharedDataTableProps,
} from "@/components/shared/data-table";
import { useCompetitions } from "@/hooks/use-convex-data";
import type { Competition } from "@/data/types-new";
import { filterCompetitionsWithState } from "@/lib/competitions-filters";
import { useCompetitionsUrlContext } from "@/lib/competitions-url-context";

interface DataTableProps {
	columns: ColumnDef<Competition, unknown>[];
}

export function DataTable({ columns }: DataTableProps) {
	const { filters, matchMode, displaySettings, setOrdering } =
		useCompetitionsUrlContext();

	const filterState = useMemo(
		() => ({ ...filters, matchMode }),
		[filters, matchMode],
	);

	const router = useRouter();
	const { competitions } = useCompetitions();

	const filterFn: SharedDataTableProps<
		Competition,
		typeof filterState
	>["filterFn"] = useMemo(
		() => (rows: Competition[], state: typeof filterState) =>
			filterCompetitionsWithState(rows, state),
		[],
	);

	const handleRowClick = useCallback(
		(competition: Competition) => {
			router.navigate({
				to: "/competitions/$id",
				params: { id: competition.id },
			});
		},
		[router],
	);

	return (
		<SharedDataTable<Competition, typeof filterState>
			columns={columns}
			data={competitions}
			filterState={filterState}
			filterFn={filterFn}
			grouping={displaySettings.grouping}
			subGrouping={displaySettings.subGrouping}
			ordering={displaySettings.ordering}
			setOrdering={setOrdering}
			containerClassName="px-4"
			emptyLabel="No results."
			onRowClick={handleRowClick}
		/>
	);
}
