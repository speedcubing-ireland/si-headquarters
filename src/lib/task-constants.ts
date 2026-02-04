import type { TaskPriority, TaskStatus } from "@/data/types-new";

export const statusOrder: Record<TaskStatus, number> = {
	backlog: 0,
	"to-do": 1,
	"in-progress": 2,
	"awaiting-review": 3,
	done: 4,
	cancelled: 5,
};

export const priorityOrder: Record<TaskPriority, number> = {
	low: 0,
	medium: 1,
	high: 2,
	urgent: 3,
};

export const statusLabels: Record<TaskStatus, string> = {
	backlog: "Backlog",
	"to-do": "To Do",
	"in-progress": "In Progress",
	"awaiting-review": "Awaiting Review",
	done: "Done",
	cancelled: "Cancelled",
};

export const priorityLabels: Record<TaskPriority, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	urgent: "Urgent",
};

// Default values for task creation
export const DEFAULT_TASK_STATUS: TaskStatus = "to-do";
export const DEFAULT_TASK_PRIORITY: TaskPriority = "medium";
export const DEFAULT_PHASE_INDEX = 0;

export const statusColors: Record<TaskStatus, string> = {
	backlog: "bg-muted text-muted-foreground",
	"to-do": "bg-blue-500/20 text-blue-400",
	"in-progress": "bg-yellow-500/20 text-yellow-400",
	"awaiting-review": "bg-purple-500/20 text-purple-400",
	done: "bg-green-500/20 text-green-400",
	cancelled: "bg-red-500/20 text-red-400",
};
