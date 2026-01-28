import {
	CircleCheck,
	type LucideIcon,
	Signal,
	SignalHigh,
	SignalMedium,
	TriangleAlert,
	User,
} from "lucide-react";
import type { Priority, Status, User as UserType } from "@/data/types";

export type FilterType = "status" | "priority" | "leads";

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

const statusOptions: FilterOption<Status>[] = [
	{ value: "concept", label: "Concept", icon: CircleCheck },
	{ value: "pre-announcement", label: "Pre-Announcement", icon: CircleCheck },
	{ value: "post-announcement", label: "Post-Announcement", icon: CircleCheck },
	{ value: "pre-competition", label: "Pre-Competition", icon: CircleCheck },
	{ value: "post-competition", label: "Post-Competition", icon: CircleCheck },
	{ value: "archive", label: "Archive", icon: CircleCheck },
];

const priorityOptions: FilterOption<Priority>[] = [
	{ value: "low", label: "Low", icon: SignalMedium },
	{ value: "medium", label: "Medium", icon: SignalHigh },
	{ value: "high", label: "High", icon: Signal },
	{ value: "urgent", label: "Urgent", icon: TriangleAlert },
];

function buildOrderMap<T extends string>(
	options: FilterOption<T>[],
): Record<T, number> {
	return options.reduce(
		(acc, option, index) => {
			acc[option.value] = index as T extends string ? number : never;
			return acc;
		},
		{} as Record<T, number>,
	);
}

export const statusOrder: Record<Status, number> = buildOrderMap(statusOptions);
export const priorityOrder: Record<Priority, number> =
	buildOrderMap(priorityOptions);

// Build leads options from provided users
function getLeadsOptions(users: UserType[]): FilterOption<string>[] {
	return users.map((user) => ({
		value: user.name,
		label: user.name,
		icon: null,
		avatarUrl: user.avatarUrl,
	}));
}

// Filter type configurations
export const filterConfigs: Record<FilterType, FilterTypeConfig> = {
	status: {
		type: "status",
		icon: CircleCheck,
		label: "Status",
		placeholder: "Search status...",
		emptyMessage: "No status found.",
		getOptions: () => statusOptions,
	},
	priority: {
		type: "priority",
		icon: SignalHigh,
		label: "Priority",
		placeholder: "Search priority...",
		emptyMessage: "No priority found.",
		getOptions: () => priorityOptions,
	},
	leads: {
		type: "leads",
		icon: User,
		label: "Lead",
		placeholder: "Search lead...",
		emptyMessage: "No user found.",
		// Options for leads are built from users at call site
		getOptions: () => [],
	},
};

// Helper to get filter options by type
export function getFilterOptions<T extends FilterType>(
	type: T,
	users?: UserType[],
): FilterOption[] {
	if (type === "leads") {
		return getLeadsOptions(users ?? []);
	}
	return filterConfigs[type].getOptions();
}
