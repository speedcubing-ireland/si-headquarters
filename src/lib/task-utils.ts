import { format } from "date-fns";
import {
	CheckCircle2,
	Circle,
	CircleDashed,
	CircleDot,
	Dice1,
	Dice2,
	Dice3,
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

export function getInitials(name: string): string {
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

export function formatDate(date?: string | null): string {
	if (!date) return "";
	try {
		return format(new Date(date), "MMM d, yyyy");
	} catch {
		return date;
	}
}

export function formatDateShort(date?: string | null): string {
	if (!date) return "";
	try {
		return format(new Date(date), "MMM d");
	} catch {
		return date;
	}
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
		case "done":
			return CheckCircle2;
		case "cancelled":
			return XCircle;
	}
}

export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 3)}...`;
}

export type TasksByPhaseGroup = {
	phase: CompetitionPhase | null;
	tasks: Task[];
};

/**
 * Group tasks that belong to a competition into buckets that mirror the
 * competition's phase ordering, with an optional \"unassigned\" group for
 * tasks that either don't have a phase or whose phase doesn't belong to
 * the competition.
 */
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

/**
 * Return all tasks that are linked to a given competition either:
 * - directly via `parent.type === "competition"` and matching `linkedId`, or
 * - indirectly via a phase that belongs to the competition.
 */
export function getTasksForCompetition(
	tasks: Task[],
	competition: Competition,
): Task[] {
	return tasks.filter((task) => {
		if (task.parent?.type === "competition") {
			return task.parent.linkedId === competition.id;
		}
		if (task.phase) {
			return competition.phases.some((phase) => phase.id === task.phase?.id);
		}
		return false;
	});
}
