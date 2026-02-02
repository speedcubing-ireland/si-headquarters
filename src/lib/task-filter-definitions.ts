import type { LucideIcon } from "lucide-react";
import {
	CheckCircle,
	CheckCircle2,
	Circle,
	CircleDashed,
	CircleDot,
	CircleUser,
	Dice1,
	Dice2,
	Dice3,
	Folder,
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
	Team as TeamType,
} from "@/data/types-new";

// Ordering constants for sorting
export const taskStatusOrder: Record<TaskStatus, number> = {
	backlog: 0,
	"to-do": 1,
	"in-progress": 2,
	"awaiting-review": 3,
	done: 4,
	cancelled: 5,
};

export const taskPriorityOrder: Record<TaskPriority, number> = {
	low: 0,
	medium: 1,
	high: 2,
	urgent: 3,
};

// From new.tasks.my.tsx - discriminated union for option rendering
export type TaskFilterValue = {
	value: string;
	label: string;
} & (
	| { iconType: "icon"; icon: LucideIcon }
	| { iconType: "avatar"; avatarUrl: string }
	| { iconType: "none" }
);

// Context passed to dynamic getValues functions
export type FilterContext = {
	users: UserType[];
	teams: TeamType[];
	labels: TaskLabel[];
};

// From new.tasks.my.tsx - fixed vs dynamic filter types
export type TaskFilterType = {
	id: string; // "status" | "priority" | "assignee" | etc.
	displayName: string; // "Status", "Priority", "Person", etc.
	displayIcon: LucideIcon;
} & (
	| { type: "fixed"; values: TaskFilterValue[] }
	| { type: "dynamic"; getValues: (ctx: FilterContext) => TaskFilterValue[] }
);

// The single source of truth - add new filters here only
export const TASK_FILTER_TYPES: TaskFilterType[] = [
	{
		id: "status",
		type: "fixed",
		displayName: "Status",
		displayIcon: CheckCircle,
		values: [
			{
				value: "backlog",
				label: "Backlog",
				iconType: "icon",
				icon: CircleDashed,
			},
			{ value: "to-do", label: "To Do", iconType: "icon", icon: Circle },
			{
				value: "in-progress",
				label: "In Progress",
				iconType: "icon",
				icon: CircleDot,
			},
			{
				value: "awaiting-review",
				label: "Awaiting Review",
				iconType: "icon",
				icon: CircleUser,
			},
			{ value: "done", label: "Done", iconType: "icon", icon: CheckCircle2 },
			{
				value: "cancelled",
				label: "Cancelled",
				iconType: "icon",
				icon: XCircle,
			},
		],
	},
	{
		id: "priority",
		type: "fixed",
		displayName: "Priority",
		displayIcon: Dice2,
		values: [
			{ value: "low", label: "Low", iconType: "icon", icon: Dice1 },
			{ value: "medium", label: "Medium", iconType: "icon", icon: Dice2 },
			{ value: "high", label: "High", iconType: "icon", icon: Dice3 },
			{
				value: "urgent",
				label: "Urgent",
				iconType: "icon",
				icon: TriangleAlert,
			},
		],
	},
	{
		id: "assignee",
		type: "dynamic",
		displayName: "Person",
		displayIcon: User,
		getValues: (ctx) =>
			ctx.users.map((u) => ({
				value: u.id,
				label: u.name,
				iconType: "avatar",
				avatarUrl: u.avatarUrl ?? "",
			})),
	},
	{
		id: "labels",
		type: "dynamic",
		displayName: "Labels",
		displayIcon: Tag,
		getValues: (ctx) =>
			ctx.labels.map((l) => ({
				value: l.id,
				label: l.name,
				iconType: "none",
			})),
	},
	{
		id: "owner",
		type: "dynamic",
		displayName: "Owner",
		displayIcon: Users,
		getValues: (ctx) => [
			...ctx.users.map((u) => ({
				value: u.id,
				label: u.name,
				iconType: "avatar" as const,
				avatarUrl: u.avatarUrl ?? "",
			})),
			...ctx.teams.map((t) => ({
				value: t.id,
				label: t.name,
				iconType: "none" as const,
			})),
		],
	},
	{
		id: "parentType",
		type: "fixed",
		displayName: "Parent",
		displayIcon: Folder,
		values: [
			{ value: "task", label: "Sub-task", iconType: "icon", icon: Folder },
			{ value: "phase", label: "Phase", iconType: "icon", icon: Folder },
			{
				value: "competition",
				label: "Competition",
				iconType: "icon",
				icon: Folder,
			},
		],
	},
];

// Helper to get options for a filter type
export function getFilterValues(
	typeId: string,
	ctx: FilterContext,
): TaskFilterValue[] {
	const filterType = TASK_FILTER_TYPES.find((t) => t.id === typeId);
	if (!filterType) return [];
	return filterType.type === "fixed"
		? filterType.values
		: filterType.getValues(ctx);
}

// Helper to get filter type config by id
export function getFilterConfig(typeId: string): TaskFilterType | undefined {
	return TASK_FILTER_TYPES.find((t) => t.id === typeId);
}

// Get all filter type IDs
export function getFilterTypeIds(): string[] {
	return TASK_FILTER_TYPES.map((t) => t.id);
}
