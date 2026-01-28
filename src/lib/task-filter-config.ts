import {
	CheckCircle2,
	Circle,
	CircleDashed,
	CircleDot,
	Dice1,
	Dice2,
	Dice3,
	Folder,
	type LucideIcon,
	Tag,
	TriangleAlert,
	User,
	Users,
	XCircle,
} from "lucide-react";
import type {
	TaskLabel,
	TaskPriority,
	TaskStatus,
	User as UserType,
} from "@/data/types-new";

export type TaskFilterType =
	| "status"
	| "priority"
	| "assignee"
	| "labels"
	| "owner"
	| "parentType";

export interface TaskFilterOption<T = string> {
	value: T;
	label: string;
	icon: LucideIcon | null;
	avatarUrl?: string;
	color?: string;
}

export interface TaskFilterTypeConfig {
	type: TaskFilterType;
	icon: LucideIcon;
	label: string;
	placeholder: string;
	emptyMessage: string;
	getOptions: () => TaskFilterOption[];
}

const statusOptions: TaskFilterOption<TaskStatus>[] = [
	{ value: "backlog", label: "Backlog", icon: CircleDashed },
	{ value: "to-do", label: "To Do", icon: Circle },
	{ value: "in-progress", label: "In Progress", icon: CircleDot },
	{ value: "done", label: "Done", icon: CheckCircle2 },
	{ value: "cancelled", label: "Cancelled", icon: XCircle },
];

const priorityOptions: TaskFilterOption<TaskPriority>[] = [
	{ value: "low", label: "Low", icon: Dice1 },
	{ value: "medium", label: "Medium", icon: Dice2 },
	{ value: "high", label: "High", icon: Dice3 },
	{ value: "urgent", label: "Urgent", icon: TriangleAlert },
];

const parentTypeOptions: TaskFilterOption<"task" | "phase" | "competition">[] =
	[
		{ value: "task", label: "Sub-task", icon: Folder },
		{ value: "phase", label: "Phase", icon: Folder },
		{ value: "competition", label: "Competition", icon: Folder },
	];

export function getAssigneeOptions(
	users: UserType[],
): TaskFilterOption<string>[] {
	return users.map((user) => ({
		value: user.id,
		label: user.name,
		icon: null,
		avatarUrl: user.avatarUrl,
	}));
}

export function getOwnerOptions(users: UserType[]): TaskFilterOption<string>[] {
	return users.map((user) => ({
		value: user.id,
		label: user.name,
		icon: null,
		avatarUrl: user.avatarUrl,
	}));
}

export function getLabelOptions(
	labels: TaskLabel[],
): TaskFilterOption<string>[] {
	return labels.map((label) => ({
		value: label.id,
		label: label.name,
		icon: null,
		color: label.color,
	}));
}

export const taskFilterConfigs: Record<TaskFilterType, TaskFilterTypeConfig> = {
	status: {
		type: "status",
		icon: Circle,
		label: "Status",
		placeholder: "Search",
		emptyMessage: "No status found.",
		getOptions: () => statusOptions,
	},
	priority: {
		type: "priority",
		icon: Dice2,
		label: "Priority",
		placeholder: "Search",
		emptyMessage: "No priority found.",
		getOptions: () => priorityOptions,
	},
	assignee: {
		type: "assignee",
		icon: User,
		label: "Assignee",
		placeholder: "Search",
		emptyMessage: "No user found.",
		getOptions: () => [],
	},
	owner: {
		type: "owner",
		icon: Users,
		label: "Owner",
		placeholder: "Search",
		emptyMessage: "No owner found.",
		getOptions: () => [],
	},
	labels: {
		type: "labels",
		icon: Tag,
		label: "Labels",
		placeholder: "Search",
		emptyMessage: "No labels found.",
		getOptions: () => [],
	},
	parentType: {
		type: "parentType",
		icon: Folder,
		label: "Parent Type",
		placeholder: "Search",
		emptyMessage: "No type found.",
		getOptions: () => parentTypeOptions,
	},
};

export function getTaskFilterOptions<T extends TaskFilterType>(
	type: T,
	users?: UserType[],
	labels?: TaskLabel[],
): TaskFilterOption[] {
	if (type === "assignee") {
		return getAssigneeOptions(users ?? []);
	}
	if (type === "owner") {
		return getOwnerOptions(users ?? []);
	}
	if (type === "labels") {
		return getLabelOptions(labels ?? []);
	}
	return taskFilterConfigs[type].getOptions();
}

export const taskStatusOrder: Record<TaskStatus, number> = {
	backlog: 0,
	"to-do": 1,
	"in-progress": 2,
	done: 3,
	cancelled: 4,
};

export const taskPriorityOrder: Record<TaskPriority, number> = {
	low: 0,
	medium: 1,
	high: 2,
	urgent: 3,
};
