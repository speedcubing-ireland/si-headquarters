import { useTasksDisplaySettingsStore } from "./tasks-display-settings-store";
import { useTasksFilterStore } from "./tasks-filter-store";
import { useEntitySavedViews } from "./use-entity-saved-views";

export function useTasksSavedViews() {
	return useEntitySavedViews({
		entity: "tasks",
		filterStore: useTasksFilterStore,
		displaySettingsStore: useTasksDisplaySettingsStore,
	});
}
