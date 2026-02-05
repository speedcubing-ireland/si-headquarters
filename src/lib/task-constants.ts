import type { TaskPriority, TaskStatus } from "@/data/types-new";

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

export const DEFAULT_TASK_STATUS: TaskStatus = "to-do";
export const DEFAULT_TASK_PRIORITY: TaskPriority = "medium";

export const statusColors: Record<TaskStatus, string> = {
	backlog: "bg-muted text-muted-foreground",
	"to-do": "bg-blue-500/20 text-blue-400",
	"in-progress": "bg-yellow-500/20 text-yellow-400",
	"awaiting-review": "bg-purple-500/20 text-purple-400",
	done: "bg-green-500/20 text-green-400",
	cancelled: "bg-red-500/20 text-red-400",
};
