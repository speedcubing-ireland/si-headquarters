import { CalendarClock, type LucideIcon, User } from "lucide-react";
import {
	COMPETITION_PHASE_KEYS,
	type CompetitionPhaseKey,
	type User as UserType,
} from "@/data/types-new";
import { getPhaseLabel } from "@/lib/competition-phase-config";

export type FilterType = "phase" | "compLead" | "leadDelegate" | "organisers";

export interface FilterOption<T = string> {
	value: T;
	label: string;
	icon: LucideIcon | null;
	avatarUrl?: string;
}

export interface FilterTypeConfig {
	type: FilterType;
	icon: LucideIcon;
	label: string;
	placeholder: string;
	emptyMessage: string;
	getOptions: () => FilterOption[];
}

// Build options from provided users or phases
function getUserOptions(users: UserType[]): FilterOption<string>[] {
	return users.map((user) => ({
		value: user.name,
		label: user.name,
		icon: null,
		avatarUrl: user.avatarUrl,
	}));
}

function getPhaseOptions(): FilterOption<CompetitionPhaseKey>[] {
	return COMPETITION_PHASE_KEYS.map((key) => ({
		value: key,
		label: getPhaseLabel(key),
		icon: CalendarClock,
	}));
}

// Filter type configurations
export const filterConfigs: Record<FilterType, FilterTypeConfig> = {
	phase: {
		type: "phase",
		icon: CalendarClock,
		label: "Phase",
		placeholder: "Search",
		emptyMessage: "No phase found.",
		getOptions: () => [],
	},
	compLead: {
		type: "compLead",
		icon: User,
		label: "Comp lead",
		placeholder: "Search",
		emptyMessage: "No user found.",
		getOptions: () => [],
	},
	leadDelegate: {
		type: "leadDelegate",
		icon: User,
		label: "Lead delegate",
		placeholder: "Search",
		emptyMessage: "No user found.",
		getOptions: () => [],
	},
	organisers: {
		type: "organisers",
		icon: User,
		label: "Organiser",
		placeholder: "Search",
		emptyMessage: "No user found.",
		getOptions: () => [],
	},
};

// Helper to get filter options by type.
export function getFilterOptions<T extends FilterType>(
	type: T,
	users?: UserType[],
): FilterOption[] {
	if (type === "phase") {
		return getPhaseOptions();
	}
	if (type === "compLead" || type === "leadDelegate" || type === "organisers") {
		return getUserOptions(users ?? []);
	}

	return filterConfigs[type].getOptions();
}
