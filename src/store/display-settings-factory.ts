import { create } from "zustand";

export interface DisplaySettingsState {
	grouping: string | null;
	subGrouping: string | null;
	ordering: {
		field: string | null;
		direction: "asc" | "desc";
	};

	setGrouping: (field: string | null) => void;
	setSubGrouping: (field: string | null) => void;
	setOrdering: (field: string | null, direction: "asc" | "desc") => void;
	toggleOrderDirection: () => void;

	toJSON: () => string;
	fromJSON: (json: string) => void;
	reset: () => void;
}

export function createDisplaySettingsStore() {
	return create<DisplaySettingsState>((set, get) => ({
		grouping: null,
		subGrouping: null,
		ordering: {
			field: null,
			direction: "asc",
		},

		setGrouping: (field) => {
			set((state) => {
				const shouldClearSubGroup =
					field === null || field === state.subGrouping;
				return {
					grouping: field,
					subGrouping: shouldClearSubGroup ? null : state.subGrouping,
				};
			});
		},

		setSubGrouping: (field) => {
			set({ subGrouping: field });
		},

		setOrdering: (field, direction) => {
			set({
				ordering: {
					field,
					direction,
				},
			});
		},

		toggleOrderDirection: () => {
			set((state) => ({
				ordering: {
					...state.ordering,
					direction: state.ordering.direction === "asc" ? "desc" : "asc",
				},
			}));
		},

		toJSON: () => {
			const { grouping, subGrouping, ordering } = get();
			return JSON.stringify({ grouping, subGrouping, ordering });
		},

		fromJSON: (json: string) => {
			try {
				const data = JSON.parse(json);
				set({
					grouping: data.grouping || null,
					subGrouping: data.subGrouping || null,
					ordering: data.ordering || {
						field: null,
						direction: "asc",
					},
				});
			} catch (error) {
				console.error("Failed to parse display settings JSON:", error);
			}
		},

		reset: () => {
			set({
				grouping: null,
				subGrouping: null,
				ordering: {
					field: null,
					direction: "asc",
				},
			});
		},
	}));
}
