import type { Task } from "@/data/types-new";
import type { DateRangeFilter, TasksFilters } from "@/lib/filter-types";
import { createFilterEngine, hasDateRangeValue } from "./shared-filter-engine";

function buildDateMatcher(
	dateRange?: DateRangeFilter,
): (task: Task) => boolean {
	if (!hasDateRangeValue(dateRange)) return () => true;

	return (task: Task) => {
		if (!dateRange || !hasDateRangeValue(dateRange)) return true;
		const { start, end, isNot } = dateRange;
		const dueDate = task.dueDate ? new Date(task.dueDate) : null;
		const startDate = start ? new Date(start) : null;
		const endDate = end ? new Date(end) : null;

		const matchesDateRange =
			!!dueDate &&
			(!startDate || dueDate >= startDate) &&
			(!endDate || dueDate <= endDate);

		return isNot ? !matchesDateRange : matchesDateRange;
	};
}

const taskEngine = createFilterEngine<Task, TasksFilters>(
	[
		{ key: "status", getValue: (t) => t.status },
		{ key: "priority", getValue: (t) => t.priority },
		{ key: "assignee", getValue: (t) => t.assignee?.id },
		{ key: "labels", getValue: (t) => t.labels.map((l) => l.id) },
		{
			key: "owner",
			getValue: (t) =>
				t.owner && "id" in t.owner ? (t.owner as { id: string }).id : undefined,
		},
		{ key: "parentType", getValue: (t) => t.parent?.type },
	],
	buildDateMatcher,
);

export const filterTasksWithState = taskEngine.filterWithState.bind(taskEngine);
