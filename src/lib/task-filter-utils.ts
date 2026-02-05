import type { Task } from "@/data/types-new";

export type MatchMode = "all" | "any";
export type TaskPredicate = (task: Task) => boolean;

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
		return isAll;
	});
}

export function createOwnerPredicate(ownerIds: string[]): TaskPredicate {
	return (task) => {
		if (!task.owner) return false;
		return "id" in task.owner && ownerIds.includes(task.owner.id);
	};
}

export function createApprovalPredicate(ids: string[]): TaskPredicate {
	return (task) =>
		task.requiredApprovalBy.some((entity) => ids.includes(entity.id));
}
