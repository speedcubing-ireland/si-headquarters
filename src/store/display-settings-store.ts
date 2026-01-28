import {
	createDisplaySettingsStore,
	type DisplaySettingsState,
} from "@/store/display-settings-factory";

export type { DisplaySettingsState };

export const useDisplaySettingsStore = createDisplaySettingsStore();
