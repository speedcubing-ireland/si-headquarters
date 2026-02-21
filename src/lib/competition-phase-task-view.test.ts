import { describe, expect, test } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { CompetitionPhase, Task } from "@/data/types-new";
import type { TasksByPhaseGroup } from "@/lib/task-utils";
import {
	buildCompetitionPhaseTaskView,
	isArchivePhaseName,
	isFinishedTask,
	resolveGroupCollapseState,
	togglePhaseCollapsedState,
} from "./competition-phase-task-view";

function makeTask({
	id,
	status,
	parent = null,
}: {
	id: string;
	status: Task["status"];
	parent?: Task["parent"];
}): Task {
	return {
		id: id as Id<"tasks">,
		status,
		parent,
	} as Task;
}

function makeGroup({
	phaseId,
	tasks,
}: {
	phaseId: string | null;
	tasks: Task[];
}): TasksByPhaseGroup {
	return {
		phase: phaseId
			? ({ id: phaseId, name: `Phase ${phaseId}` } as CompetitionPhase)
			: null,
		tasks,
	};
}

function defaultOptions(overrides?: {
	hideFinishedTasks?: boolean;
	collapseCompletedPhases?: boolean;
	showSubtasks?: boolean;
	manuallyCollapsedPhaseKeys?: Set<string>;
	manuallyExpandedCompletedPhaseKeys?: Set<string>;
}) {
	return {
		hideFinishedTasks: false,
		collapseCompletedPhases: true,
		showSubtasks: false,
		manuallyCollapsedPhaseKeys: new Set<string>(),
		manuallyExpandedCompletedPhaseKeys: new Set<string>(),
		...overrides,
	};
}

describe("competition phase task view", () => {
	test("treats done and cancelled as finished", () => {
		expect(isFinishedTask(makeTask({ id: "a", status: "done" }))).toBe(true);
		expect(isFinishedTask(makeTask({ id: "b", status: "cancelled" }))).toBe(
			true,
		);
		expect(isFinishedTask(makeTask({ id: "c", status: "to-do" }))).toBe(false);
	});

	test("detects archive phase names", () => {
		expect(isArchivePhaseName("Archive")).toBe(true);
		expect(isArchivePhaseName("archive (legacy)")).toBe(true);
		expect(isArchivePhaseName("Pre-Competition")).toBe(false);
		expect(isArchivePhaseName(null)).toBe(false);
	});

	test("excludes subtasks when showSubtasks is false", () => {
		const parentTask = makeTask({ id: "parent", status: "to-do" });
		const subtask = makeTask({
			id: "subtask",
			status: "to-do",
			parent: { type: "task", linkedId: "parent" as Id<"tasks"> },
		});

		const views = buildCompetitionPhaseTaskView(
			[makeGroup({ phaseId: "p1", tasks: [parentTask, subtask] })],
			defaultOptions({ showSubtasks: false }),
		);

		expect(views).toHaveLength(1);
		expect(views[0]?.visibleTasks.map((task) => task.id)).toEqual([
			parentTask.id,
		]);
	});

	test("hides finished tasks when hideFinishedTasks is enabled", () => {
		const toDo = makeTask({ id: "todo", status: "to-do" });
		const done = makeTask({ id: "done", status: "done" });
		const cancelled = makeTask({ id: "cancelled", status: "cancelled" });

		const views = buildCompetitionPhaseTaskView(
			[makeGroup({ phaseId: "p1", tasks: [toDo, done, cancelled] })],
			defaultOptions({ hideFinishedTasks: true, showSubtasks: true }),
		);

		expect(views).toHaveLength(1);
		expect(views[0]?.visibleTasks.map((task) => task.id)).toEqual([toDo.id]);
	});

	test("marks a phase complete when all completion tasks are finished", () => {
		const done = makeTask({ id: "done", status: "done" });
		const cancelled = makeTask({ id: "cancelled", status: "cancelled" });

		const views = buildCompetitionPhaseTaskView(
			[makeGroup({ phaseId: "p1", tasks: [done, cancelled] })],
			defaultOptions({ showSubtasks: true }),
		);

		expect(views).toHaveLength(1);
		expect(views[0]?.phaseCompleted).toBe(true);
	});

	test("keeps groups even when all tasks are filtered out", () => {
		const doneA = makeTask({ id: "done-a", status: "done" });
		const cancelledB = makeTask({ id: "cancelled-b", status: "cancelled" });

		const views = buildCompetitionPhaseTaskView(
			[
				makeGroup({ phaseId: "p1", tasks: [doneA] }),
				makeGroup({ phaseId: "p2", tasks: [cancelledB] }),
			],
			defaultOptions({ hideFinishedTasks: true, showSubtasks: true }),
		);

		expect(views).toHaveLength(2);
		expect(views[0]?.visibleTasks).toHaveLength(0);
		expect(views[1]?.visibleTasks).toHaveLength(0);
	});

	test("supports auto-collapse and manual override for completed phases", () => {
		const groupKey = "p1";

		const initial = resolveGroupCollapseState({
			groupKey,
			phaseCompleted: true,
			collapseCompletedPhases: true,
			manuallyCollapsedPhaseKeys: new Set<string>(),
			manuallyExpandedCompletedPhaseKeys: new Set<string>(),
		});
		expect(initial.autoCollapsed).toBe(true);
		expect(initial.isCollapsed).toBe(true);

		const expandedOverride = togglePhaseCollapsedState({
			groupKey,
			phaseCompleted: true,
			collapseCompletedPhases: true,
			manuallyCollapsedPhaseKeys: new Set<string>(),
			manuallyExpandedCompletedPhaseKeys: new Set<string>(),
		});
		expect(expandedOverride.manuallyExpandedCompletedPhaseKeys.has(groupKey)).toBe(
			true,
		);

		const expandedState = resolveGroupCollapseState({
			groupKey,
			phaseCompleted: true,
			collapseCompletedPhases: true,
			manuallyCollapsedPhaseKeys: expandedOverride.manuallyCollapsedPhaseKeys,
			manuallyExpandedCompletedPhaseKeys:
				expandedOverride.manuallyExpandedCompletedPhaseKeys,
		});
		expect(expandedState.autoCollapsed).toBe(false);
		expect(expandedState.isCollapsed).toBe(false);

		const restoredAutoCollapse = togglePhaseCollapsedState({
			groupKey,
			phaseCompleted: true,
			collapseCompletedPhases: true,
			manuallyCollapsedPhaseKeys: expandedOverride.manuallyCollapsedPhaseKeys,
			manuallyExpandedCompletedPhaseKeys:
				expandedOverride.manuallyExpandedCompletedPhaseKeys,
		});
		expect(
			restoredAutoCollapse.manuallyExpandedCompletedPhaseKeys.has(groupKey),
		).toBe(false);
	});

	test("auto-collapses archive phase even when not completed", () => {
		const groupKey = "archive-phase";
		const collapsed = resolveGroupCollapseState({
			groupKey,
			phaseCompleted: false,
			phaseName: "Archive",
			collapseCompletedPhases: false,
			manuallyCollapsedPhaseKeys: new Set<string>(),
			manuallyExpandedCompletedPhaseKeys: new Set<string>(),
		});
		expect(collapsed.autoCollapsed).toBe(true);
		expect(collapsed.isCollapsed).toBe(true);

		const expandedOverride = togglePhaseCollapsedState({
			groupKey,
			phaseCompleted: false,
			phaseName: "Archive",
			collapseCompletedPhases: false,
			manuallyCollapsedPhaseKeys: new Set<string>(),
			manuallyExpandedCompletedPhaseKeys: new Set<string>(),
		});
		expect(expandedOverride.manuallyExpandedCompletedPhaseKeys.has(groupKey)).toBe(
			true,
		);
	});

	test("auto-collapses empty phase even when not completed", () => {
		const groupKey = "empty-phase";
		const collapsed = resolveGroupCollapseState({
			groupKey,
			phaseCompleted: false,
			phaseIsEmpty: true,
			collapseCompletedPhases: false,
			manuallyCollapsedPhaseKeys: new Set<string>(),
			manuallyExpandedCompletedPhaseKeys: new Set<string>(),
		});
		expect(collapsed.autoCollapsed).toBe(true);
		expect(collapsed.isCollapsed).toBe(true);

		const expandedOverride = togglePhaseCollapsedState({
			groupKey,
			phaseCompleted: false,
			phaseIsEmpty: true,
			collapseCompletedPhases: false,
			manuallyCollapsedPhaseKeys: new Set<string>(),
			manuallyExpandedCompletedPhaseKeys: new Set<string>(),
		});
		expect(expandedOverride.manuallyExpandedCompletedPhaseKeys.has(groupKey)).toBe(
			true,
		);
	});

	test("toggles manual collapse for non-completed phases", () => {
		const groupKey = "p2";

		const collapsed = togglePhaseCollapsedState({
			groupKey,
			phaseCompleted: false,
			collapseCompletedPhases: true,
			manuallyCollapsedPhaseKeys: new Set<string>(),
			manuallyExpandedCompletedPhaseKeys: new Set<string>(),
		});
		expect(collapsed.manuallyCollapsedPhaseKeys.has(groupKey)).toBe(true);

		const collapsedState = resolveGroupCollapseState({
			groupKey,
			phaseCompleted: false,
			collapseCompletedPhases: true,
			manuallyCollapsedPhaseKeys: collapsed.manuallyCollapsedPhaseKeys,
			manuallyExpandedCompletedPhaseKeys:
				collapsed.manuallyExpandedCompletedPhaseKeys,
		});
		expect(collapsedState.autoCollapsed).toBe(false);
		expect(collapsedState.isCollapsed).toBe(true);

		const expanded = togglePhaseCollapsedState({
			groupKey,
			phaseCompleted: false,
			collapseCompletedPhases: true,
			manuallyCollapsedPhaseKeys: collapsed.manuallyCollapsedPhaseKeys,
			manuallyExpandedCompletedPhaseKeys:
				collapsed.manuallyExpandedCompletedPhaseKeys,
		});
		expect(expanded.manuallyCollapsedPhaseKeys.has(groupKey)).toBe(false);
	});
});
