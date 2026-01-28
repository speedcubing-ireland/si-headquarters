import { useCompetitionsFilterStore } from "./competitions-filter-store";
import { useDisplaySettingsStore } from "./display-settings-store";
import { useEntitySavedViews } from "./use-entity-saved-views";

export function useCompetitionsSavedViews() {
	return useEntitySavedViews({
		entity: "competitions",
		filterStore: useCompetitionsFilterStore,
		displaySettingsStore: useDisplaySettingsStore,
	});
}
