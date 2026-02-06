import { SharedDisplaySettings } from "@/components/shared/display-settings";
import { useTasksUrlContext } from "@/lib/tasks-url-context";
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

const tasksColumnOptions = [
	{ value: "status", label: "Status" },
	{ value: "priority", label: "Priority" },
	{ value: "owner", label: "Owner" },
	{ value: "assignee", label: "Assignee" },
	{ value: "labels", label: "Labels" },
	{ value: "dueDate", label: "Due Date" },
	{ value: "title", label: "Title" },
];

export function TasksDisplaySettings() {
	const { displaySettings, setGrouping, setSubGrouping, setOrdering } =
		useTasksUrlContext();

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
			columnOptions={tasksColumnOptions}
			useDisplaySettingsStore={useDisplaySettingsStore}
		/>
	);
}
