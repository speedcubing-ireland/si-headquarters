import { create } from "zustand";

type CreateModalsState = {
	taskOpen: boolean;
	competitionOpen: boolean;
	openTask: () => void;
	closeTask: () => void;
	openCompetition: () => void;
	closeCompetition: () => void;
};

export const useCreateModalsStore = create<CreateModalsState>((set) => ({
	taskOpen: false,
	competitionOpen: false,
	openTask: () => set({ taskOpen: true }),
	closeTask: () => set({ taskOpen: false }),
	openCompetition: () => set({ competitionOpen: true }),
	closeCompetition: () => set({ competitionOpen: false }),
}));
