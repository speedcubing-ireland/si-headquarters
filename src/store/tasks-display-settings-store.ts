import {
	createDisplaySettingsStore,
	type DisplaySettingsState as TasksDisplaySettingsState,
} from "@/store/display-settings-factory";

export type { TasksDisplaySettingsState };

export const useTasksDisplaySettingsStore = createDisplaySettingsStore();
