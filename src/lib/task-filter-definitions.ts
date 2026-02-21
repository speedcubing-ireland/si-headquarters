import type { LucideIcon } from "lucide-react";
import {
	CheckCircle,
	CheckCircle2,
	Circle,
	CircleDashed,
	CircleDot,
	Eye,
	SignalHigh,
	SignalLow,
	SignalMedium,
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

export const taskStatusIcon: Record<TaskStatus, LucideIcon> = {
	backlog: CircleDashed,
	"to-do": Circle,
	"in-progress": CircleDot,
	"awaiting-review": Eye,
	done: CheckCircle2,
	cancelled: XCircle,
};

export const taskPriorityIcon: Record<TaskPriority, LucideIcon> = {
	low: SignalLow,
	medium: SignalMedium,
	high: SignalHigh,
	urgent: TriangleAlert,
};

export function getTaskStatusIcon(status: TaskStatus): LucideIcon {
	return taskStatusIcon[status];
}

export function getTaskPriorityIcon(priority: TaskPriority): LucideIcon {
	return taskPriorityIcon[priority];
}

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
				icon: taskStatusIcon.backlog,
			},
			{ value: "to-do", label: "To Do", icon: taskStatusIcon["to-do"] },
			{
				value: "in-progress",
				label: "In Progress",
				icon: taskStatusIcon["in-progress"],
			},
			{
				value: "awaiting-review",
				label: "Awaiting Review",
				icon: taskStatusIcon["awaiting-review"],
			},
			{ value: "done", label: "Done", icon: taskStatusIcon.done },
			{
				value: "cancelled",
				label: "Cancelled",
				icon: taskStatusIcon.cancelled,
			},
		],
	},
	{
		id: "priority",
		type: "fixed",
		displayName: "Priority",
		displayIcon: SignalMedium,
		values: [
			{ value: "low", label: "Low", icon: taskPriorityIcon.low },
			{ value: "medium", label: "Medium", icon: taskPriorityIcon.medium },
			{ value: "high", label: "High", icon: taskPriorityIcon.high },
			{
				value: "urgent",
				label: "Urgent",
				icon: taskPriorityIcon.urgent,
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
