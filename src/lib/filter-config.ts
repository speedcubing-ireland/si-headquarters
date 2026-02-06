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

export const filterConfigs: Record<
	FilterType,
	{
		type: FilterType;
		icon: LucideIcon;
		label: string;
		placeholder: string;
		emptyMessage: string;
	}
> = {
	phase: {
		type: "phase",
		icon: CalendarClock,
		label: "Phase",
		placeholder: "Search",
		emptyMessage: "No phase found.",
	},
	compLead: {
		type: "compLead",
		icon: User,
		label: "Comp lead",
		placeholder: "Search",
		emptyMessage: "No user found.",
	},
	leadDelegate: {
		type: "leadDelegate",
		icon: User,
		label: "Lead delegate",
		placeholder: "Search",
		emptyMessage: "No user found.",
	},
	organisers: {
		type: "organisers",
		icon: User,
		label: "Organiser",
		placeholder: "Search",
		emptyMessage: "No user found.",
	},
};

export function getFilterOptions<T extends FilterType>(
	type: T,
	users?: UserType[],
): FilterOption[] {
	if (type === "phase") {
		return getPhaseOptions();
	}
	return getUserOptions(users ?? []);
}
