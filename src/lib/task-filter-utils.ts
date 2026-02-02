import type { Task } from "@/data/types-new";

export type MatchMode = "all" | "any";
export type TaskPredicate = (task: Task) => boolean;

/**
 * Filter tasks using multiple predicates with configurable match mode
 *
 * @param tasks - Array of tasks to filter
 * @param mode - Match mode: "all" requires all predicates to match, "any" requires at least one
 * @param predicates - Array of predicate functions to test against each task
 * @returns Filtered array of tasks
 */
export function bulkFilterItems(
	tasks: Task[],
	mode: MatchMode,
	predicates: TaskPredicate[],
): Task[] {
	if (predicates.length === 0) return tasks;

	const isAny = mode === "any";
	const isAll = mode === "all";

	return tasks.filter((task) => {
		for (const predicate of predicates) {
			if (isAny && predicate(task)) return true;
			if (isAll && !predicate(task)) return false;
		}
		// For "all" mode: all predicates passed, return true
		// For "any" mode: no predicates matched, return false
		return isAll;
	});
}

/**
 * Create a predicate that checks if a task matches any of the given IDs
 */
export function createIdPredicate(
	ids: string[],
	getter: (task: Task) => string | null | undefined,
): TaskPredicate {
	return (task) => {
		const value = getter(task);
		return value !== null && value !== undefined && ids.includes(value);
	};
}

/**
 * Create a predicate that checks if a task's assignee matches any of the given user IDs
 */
export function createAssigneePredicate(userIds: string[]): TaskPredicate {
	return (task) => task.assignee !== null && userIds.includes(task.assignee.id);
}

/**
 * Create a predicate that checks if a task's owner matches any of the given IDs (users or teams)
 */
export function createOwnerPredicate(ownerIds: string[]): TaskPredicate {
	return (task) => {
		if (!task.owner) return false;
		return "id" in task.owner && ownerIds.includes(task.owner.id);
	};
}

/**
 * Create a predicate that checks if a task requires approval by any of the given IDs
 */
export function createApprovalPredicate(ids: string[]): TaskPredicate {
	return (task) =>
		task.requiredApprovalBy.some((entity) => ids.includes(entity.id));
}
