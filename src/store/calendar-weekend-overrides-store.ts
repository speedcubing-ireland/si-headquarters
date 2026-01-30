import { create } from "zustand";

export type WeekendOverride = {
	eventNote?: string;
	reserved?: boolean;
	announced?: boolean;
};

type CalendarWeekendOverridesStore = {
	overrides: Record<string, WeekendOverride>;
	getOverride: (rowKey: string) => WeekendOverride | undefined;
	setOverride: (rowKey: string, patch: Partial<WeekendOverride>) => void;
};

export function getCalendarWeekendRowKey(
	satDate: string,
	competitionId: string | null,
): string {
	return competitionId ? `${satDate}-${competitionId}` : satDate;
}

export const useCalendarWeekendOverridesStore =
	create<CalendarWeekendOverridesStore>((set, get) => ({
		overrides: {},
		getOverride: (rowKey) => get().overrides[rowKey],
		setOverride: (rowKey, patch) => {
			set((state) => {
				const current = state.overrides[rowKey] ?? {};
				const next = { ...current, ...patch };
				const hasValues = Object.values(next).some(
					(v) => v !== undefined && v !== "",
				);
				return {
					overrides: hasValues
						? { ...state.overrides, [rowKey]: next }
						: (() => {
								const { [rowKey]: _, ...rest } = state.overrides;
								return rest;
							})(),
				};
			});
		},
	}));
