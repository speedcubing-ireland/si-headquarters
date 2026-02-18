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
	"to-do": "bg-info/15 text-info",
	"in-progress": "bg-warning/15 text-warning",
	"awaiting-review": "bg-secondary text-secondary-foreground",
	done: "bg-success/15 text-success",
	cancelled: "bg-error/15 text-error",
};
