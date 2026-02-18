import {
	CheckCircle2,
	Circle,
	CircleDashed,
	CircleDot,
	Dice1,
	Dice2,
	Dice3,
	Eye,
	type LucideIcon,
	TriangleAlert,
	XCircle,
} from "lucide-react";
import type {
	Competition,
	CompetitionPhase,
	Task,
	TaskPriority,
	TaskStatus,
} from "@/data/types-new";
import {
	taskPriorityOrder,
	taskStatusOrder,
} from "@/lib/task-filter-definitions";

export const statusIconColors: Record<TaskStatus, string> = {
	backlog: "text-muted-foreground/60",
	"to-do": "text-muted-foreground",
	"in-progress": "text-warning",
	"awaiting-review": "text-secondary-foreground",
	done: "text-success",
	cancelled: "text-error",
};

export function isUserRequiredApprover(task: Task, userId: string): boolean {
	for (const approver of task.requiredApprovalBy) {
		if (approver.id === userId) return true;
		const maybeTeam = approver as { members?: Array<{ id: string }> };
		if (maybeTeam.members?.some((m) => m.id === userId)) return true;
	}
	return false;
}

export function getPriorityIcon(priority: TaskPriority): LucideIcon {
	switch (priority) {
		case "urgent":
			return TriangleAlert;
		case "high":
			return Dice3;
		case "medium":
			return Dice2;
		case "low":
			return Dice1;
	}
}

export function getStatusIcon(status: TaskStatus): LucideIcon {
	switch (status) {
		case "backlog":
			return CircleDashed;
		case "to-do":
			return Circle;
		case "in-progress":
			return CircleDot;
		case "awaiting-review":
			return Eye;
		case "done":
			return CheckCircle2;
		case "cancelled":
			return XCircle;
	}
}

export type TasksByPhaseGroup = {
	phase: CompetitionPhase | null;
	tasks: Task[];
};

function compareTasksByStatusThenPriority(a: Task, b: Task): number {
	const statusDiff = taskStatusOrder[a.status] - taskStatusOrder[b.status];
	if (statusDiff !== 0) return statusDiff;

	return taskPriorityOrder[a.priority] - taskPriorityOrder[b.priority];
}

export function sortTasksByStatusThenPriority(tasks: Task[]): Task[] {
	return [...tasks].sort(compareTasksByStatusThenPriority);
}

export function groupTasksByCompetitionPhase(
	tasks: Task[],
	competition: Competition,
): TasksByPhaseGroup[] {
	if (tasks.length === 0) return [];

	const phaseById = new Map<string, CompetitionPhase>();
	for (const phase of competition.phases) {
		phaseById.set(phase.id, phase);
	}

	const groups = new Map<string, TasksByPhaseGroup>();
	let unassignedGroup: TasksByPhaseGroup | null = null;

	for (const task of tasks) {
		const phaseId = task.phase?.id;

		if (phaseId && phaseById.has(phaseId)) {
			const key = phaseId;
			const existing = groups.get(key);
			if (existing) {
				existing.tasks.push(task);
			} else {
				groups.set(key, {
					phase: phaseById.get(phaseId) ?? null,
					tasks: [task],
				});
			}
		} else {
			if (!unassignedGroup) {
				unassignedGroup = {
					phase: null,
					tasks: [],
				};
			}
			unassignedGroup.tasks.push(task);
		}
	}

	const ordered: TasksByPhaseGroup[] = [];

	for (const phase of competition.phases) {
		const group = groups.get(phase.id);
		if (group) {
			ordered.push(group);
		}
	}

	if (unassignedGroup && unassignedGroup.tasks.length > 0) {
		ordered.push(unassignedGroup);
	}

	return ordered;
}
