import { SharedDisplaySettings } from "@/components/shared/display-settings";
import { columnOptions } from "@/lib/competitions-constants";
import { useCompetitionsUrlContext } from "@/lib/competitions-url-context";
import { useMemo } from "react";

type DisplaySettingsState = {
	grouping: string | null;
	subGrouping: string | null;
	ordering: { field: string | null; direction: "asc" | "desc" };
	setGrouping: (field: string | null) => void;
	setSubGrouping: (field: string | null) => void;
	setOrdering: (field: string | null, direction: "asc" | "desc") => void;
	toggleOrderDirection: () => void;
	toJSON: () => string;
	fromJSON: (json: string) => void;
	reset: () => void;
};

export function DisplaySettings() {
	const { displaySettings, setGrouping, setSubGrouping, setOrdering } =
		useCompetitionsUrlContext();

	const useDisplaySettingsStore = useMemo(() => {
		return function useStore<T>(
			selector: (state: DisplaySettingsState) => T,
		): T {
			const mockState: DisplaySettingsState = {
				grouping: displaySettings.grouping,
				subGrouping: displaySettings.subGrouping,
				ordering: displaySettings.ordering,
				setGrouping,
				setSubGrouping,
				setOrdering,
				toggleOrderDirection: () => {
					setOrdering(
						displaySettings.ordering.field,
						displaySettings.ordering.direction === "asc" ? "desc" : "asc",
					);
				},
				toJSON: () =>
					JSON.stringify({
						grouping: displaySettings.grouping,
						subGrouping: displaySettings.subGrouping,
						ordering: displaySettings.ordering,
					}),
				fromJSON: () => {},
				reset: () => {
					setGrouping(null);
					setSubGrouping(null);
					setOrdering(null, "asc");
				},
			};
			return selector(mockState);
		};
	}, [displaySettings, setGrouping, setSubGrouping, setOrdering]);

	return (
		<SharedDisplaySettings
			columnOptions={columnOptions.map(({ value, label }) => ({
				value,
				label,
			}))}
			useDisplaySettingsStore={useDisplaySettingsStore}
		/>
	);
}
