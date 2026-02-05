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

export type TaskFilterValue = {
	value: string;
	label: string;
	icon?: LucideIcon | null;
	avatarUrl?: string;
	color?: string;
};

export type FilterContext = {
	users: UserType[];
	teams: TeamType[];
	labels: TaskLabel[];
};

export type TaskFilterType = {
	id: string;
	displayName: string;
	displayIcon: LucideIcon;
} & (
	| { type: "fixed"; values: TaskFilterValue[] }
	| { type: "dynamic"; getValues: (ctx: FilterContext) => TaskFilterValue[] }
);

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
				icon: CircleDashed,
			},
			{ value: "to-do", label: "To Do", icon: Circle },
			{
				value: "in-progress",
				label: "In Progress",
				icon: CircleDot,
			},
			{
				value: "awaiting-review",
				label: "Awaiting Review",
				icon: CircleUser,
			},
			{ value: "done", label: "Done", icon: CheckCircle2 },
			{
				value: "cancelled",
				label: "Cancelled",
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
			{ value: "low", label: "Low", icon: Dice1 },
			{ value: "medium", label: "Medium", icon: Dice2 },
			{ value: "high", label: "High", icon: Dice3 },
			{
				value: "urgent",
				label: "Urgent",
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
				avatarUrl: u.avatarUrl ?? "",
			})),
			...ctx.teams.map((t) => ({
				value: t.id,
				label: t.name,
			})),
		],
	},
	{
		id: "parentType",
		type: "fixed",
		displayName: "Parent",
		displayIcon: Folder,
		values: [
			{ value: "task", label: "Sub-task", icon: Folder },
			{ value: "phase", label: "Phase", icon: Folder },
			{
				value: "competition",
				label: "Competition",
				icon: Folder,
			},
		],
	},
];

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

export function getFilterConfig(typeId: string): TaskFilterType | undefined {
	return TASK_FILTER_TYPES.find((t) => t.id === typeId);
}
