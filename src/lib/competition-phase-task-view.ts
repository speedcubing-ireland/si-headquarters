import type { Task } from "@/data/types-new";
import type { TasksByPhaseGroup } from "@/lib/task-utils";

export interface CompetitionPhaseTaskViewOptions {
	hideFinishedTasks: boolean;
	collapseCompletedPhases: boolean;
	showSubtasks: boolean;
	manuallyCollapsedPhaseKeys: ReadonlySet<string>;
	manuallyExpandedCompletedPhaseKeys: ReadonlySet<string>;
}

export interface ResolveGroupCollapseStateArgs {
	groupKey: string;
	phaseCompleted: boolean;
	phaseName?: string | null;
	phaseIsEmpty?: boolean;
	collapseCompletedPhases: boolean;
	manuallyCollapsedPhaseKeys: ReadonlySet<string>;
	manuallyExpandedCompletedPhaseKeys: ReadonlySet<string>;
}

export interface CompetitionPhaseTaskGroupView {
	groupKey: string;
	group: TasksByPhaseGroup;
	visibleTasks: Task[];
	phaseCompleted: boolean;
	phaseIsEmpty: boolean;
	isCollapsed: boolean;
}

export function isFinishedTask(task: Pick<Task, "status">): boolean {
	return task.status === "done" || task.status === "cancelled";
}

export function isArchivePhaseName(phaseName?: string | null): boolean {
	if (typeof phaseName !== "string") return false;
	return phaseName.trim().toLowerCase().startsWith("archive");
}

function isSubtaskTask(task: Pick<Task, "parent">): boolean {
	return task.parent?.type === "task";
}

function resolveTasksForCompletion(
	groupTasks: Task[],
	showSubtasks: boolean,
): Task[] {
	return showSubtasks
		? groupTasks
		: groupTasks.filter((task) => !isSubtaskTask(task));
}

function resolveVisibleTasks(
	tasksForCompletion: Task[],
	hideFinishedTasks: boolean,
): Task[] {
	return hideFinishedTasks
		? tasksForCompletion.filter((task) => !isFinishedTask(task))
		: tasksForCompletion;
}

export function resolveGroupCollapseState({
	groupKey,
	phaseCompleted,
	phaseName = null,
	phaseIsEmpty = false,
	collapseCompletedPhases,
	manuallyCollapsedPhaseKeys,
	manuallyExpandedCompletedPhaseKeys,
}: ResolveGroupCollapseStateArgs): {
	autoCollapsed: boolean;
	isCollapsed: boolean;
} {
	const isArchivePhase = isArchivePhaseName(phaseName);
	const shouldAutoCollapse =
		isArchivePhase ||
		phaseIsEmpty ||
		(collapseCompletedPhases && phaseCompleted);
	const autoCollapsed =
		shouldAutoCollapse && !manuallyExpandedCompletedPhaseKeys.has(groupKey);

	return {
		autoCollapsed,
		isCollapsed: autoCollapsed || manuallyCollapsedPhaseKeys.has(groupKey),
	};
}

export interface TogglePhaseCollapsedStateArgs
	extends ResolveGroupCollapseStateArgs {}

export function togglePhaseCollapsedState({
	groupKey,
	phaseCompleted,
	phaseName = null,
	phaseIsEmpty = false,
	collapseCompletedPhases,
	manuallyCollapsedPhaseKeys,
	manuallyExpandedCompletedPhaseKeys,
}: TogglePhaseCollapsedStateArgs): {
	manuallyCollapsedPhaseKeys: Set<string>;
	manuallyExpandedCompletedPhaseKeys: Set<string>;
} {
	const nextManuallyCollapsedPhaseKeys = new Set(manuallyCollapsedPhaseKeys);
	const nextManuallyExpandedCompletedPhaseKeys = new Set(
		manuallyExpandedCompletedPhaseKeys,
	);

	const collapseState = resolveGroupCollapseState({
		groupKey,
		phaseCompleted,
		phaseName,
		phaseIsEmpty,
		collapseCompletedPhases,
		manuallyCollapsedPhaseKeys,
		manuallyExpandedCompletedPhaseKeys,
	});

	if (collapseState.autoCollapsed) {
		nextManuallyExpandedCompletedPhaseKeys.add(groupKey);
		nextManuallyCollapsedPhaseKeys.delete(groupKey);
		return {
			manuallyCollapsedPhaseKeys: nextManuallyCollapsedPhaseKeys,
			manuallyExpandedCompletedPhaseKeys:
				nextManuallyExpandedCompletedPhaseKeys,
		};
	}

	const isExpandedViaOverride =
		collapseState.autoCollapsed === false &&
		manuallyExpandedCompletedPhaseKeys.has(groupKey);
	if (isExpandedViaOverride) {
		nextManuallyExpandedCompletedPhaseKeys.delete(groupKey);
		return {
			manuallyCollapsedPhaseKeys: nextManuallyCollapsedPhaseKeys,
			manuallyExpandedCompletedPhaseKeys:
				nextManuallyExpandedCompletedPhaseKeys,
		};
	}

	if (nextManuallyCollapsedPhaseKeys.has(groupKey)) {
		nextManuallyCollapsedPhaseKeys.delete(groupKey);
	} else {
		nextManuallyCollapsedPhaseKeys.add(groupKey);
	}

	return {
		manuallyCollapsedPhaseKeys: nextManuallyCollapsedPhaseKeys,
		manuallyExpandedCompletedPhaseKeys: nextManuallyExpandedCompletedPhaseKeys,
	};
}

export function buildCompetitionPhaseTaskView(
	groups: TasksByPhaseGroup[],
	options: CompetitionPhaseTaskViewOptions,
): CompetitionPhaseTaskGroupView[] {
	return groups.map((group) => {
		const groupKey = group.phase?.id ?? "unassigned";
		const tasksForCompletion = resolveTasksForCompletion(
			group.tasks,
			options.showSubtasks,
		);
		const visibleTasks = resolveVisibleTasks(
			tasksForCompletion,
			options.hideFinishedTasks,
		);
		const phaseCompleted =
			tasksForCompletion.length > 0 &&
			tasksForCompletion.every((task) => isFinishedTask(task));
		const phaseIsEmpty = tasksForCompletion.length === 0;
		const { isCollapsed } = resolveGroupCollapseState({
			groupKey,
			phaseCompleted,
			phaseName: group.phase?.name ?? null,
			phaseIsEmpty,
			collapseCompletedPhases: options.collapseCompletedPhases,
			manuallyCollapsedPhaseKeys: options.manuallyCollapsedPhaseKeys,
			manuallyExpandedCompletedPhaseKeys:
				options.manuallyExpandedCompletedPhaseKeys,
		});

		return {
			groupKey,
			group,
			visibleTasks,
			phaseCompleted,
			phaseIsEmpty,
			isCollapsed,
		};
	});
}

export function countVisibleTasks(
	groups: CompetitionPhaseTaskGroupView[],
): number {
	return groups.reduce((count, group) => count + group.visibleTasks.length, 0);
}
