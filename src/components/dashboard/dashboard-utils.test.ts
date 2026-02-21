import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { isUserRequiredApprover } from "@/lib/task-utils";
import { classifyTask, sortTasks, buildFocusGroups } from "./my-focus-widget";
import {
	getLatestUpdateStatus,
	getCompetitionDaysText,
	getTaskProgress,
	getProgressPercent,
} from "./competition-health-widget";
import type { Task, Competition } from "@/data/types-new";
import type { Id } from "@/convex/_generated/dataModel";

const taskId = (id: string) => id as Id<"tasks">;
const userId = (id: string) => id as Id<"users">;
const compUpdateId = (id: string) => id as Id<"competitionUpdates">;

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: taskId("task-1"),
		identifier: "TSK-1",
		title: "Test task",
		status: "to-do",
		priority: "medium",
		dueDate: null,
		assignee: null,
		blocks: [],
		blockedBy: [],
		requiredApprovalBy: [],
		approvedBy: [],
		...overrides,
	} as Task;
}

function makeProgressUpdate(
	overrides: Partial<Competition["progressUpdates"][number]> = {},
): Competition["progressUpdates"][number] {
	return {
		id: compUpdateId("update-1"),
		timestamp: "2026-02-06T10:00:00Z",
		postedBy: { id: userId("poster-1"), name: "Poster", avatarUrl: "" },
		status: "on-track" as const,
		reactions: [],
		...overrides,
	};
}

function makeCompetition(overrides: Partial<Competition> = {}): Competition {
	return {
		id: "comp-1",
		name: "Test Comp",
		progressUpdates: [],
		tasks: [],
		...overrides,
	} as Competition;
}

describe("isUserRequiredApprover", () => {
	test("returns true for direct user match", () => {
		const task = makeTask({
			requiredApprovalBy: [
				{ id: "user-1", name: "Alice" },
			] as Task["requiredApprovalBy"],
		});
		expect(isUserRequiredApprover(task, "user-1")).toBe(true);
	});

	test("returns true for team member match", () => {
		const task = makeTask({
			requiredApprovalBy: [
				{
					id: "team-1",
					name: "Delegates",
					members: [{ id: "user-2", name: "Bob" }],
				},
			] as Task["requiredApprovalBy"],
		});
		expect(isUserRequiredApprover(task, "user-2")).toBe(true);
	});

	test("returns false when user is not in approvers", () => {
		const task = makeTask({
			requiredApprovalBy: [
				{ id: "user-1", name: "Alice" },
			] as Task["requiredApprovalBy"],
		});
		expect(isUserRequiredApprover(task, "user-99")).toBe(false);
	});

	test("returns false for empty approvers", () => {
		const task = makeTask({ requiredApprovalBy: [] });
		expect(isUserRequiredApprover(task, "user-1")).toBe(false);
	});
});

describe("classifyTask", () => {
	const userId = "user-1";
	let today: Date;
	let weekFromNow: Date;

	beforeEach(() => {
		today = new Date("2026-02-06");
		today.setHours(0, 0, 0, 0);
		weekFromNow = new Date(today);
		weekFromNow.setDate(today.getDate() + 7);
	});

	test("returns null for done tasks", () => {
		const task = makeTask({
			status: "done",
			assignee: { id: userId } as Task["assignee"],
		});
		expect(classifyTask(task, userId, today, weekFromNow)).toBeNull();
	});

	test("returns null for cancelled tasks", () => {
		const task = makeTask({
			status: "cancelled",
			assignee: { id: userId } as Task["assignee"],
		});
		expect(classifyTask(task, userId, today, weekFromNow)).toBeNull();
	});

	test("returns 'overdue' for past-due tasks assigned to me", () => {
		const task = makeTask({
			status: "to-do",
			assignee: { id: userId } as Task["assignee"],
			dueDate: "2026-02-04",
		});
		expect(classifyTask(task, userId, today, weekFromNow)).toBe("overdue");
	});

	test("returns 'blocking' for tasks with unresolved blocks", () => {
		const task = makeTask({
			status: "in-progress",
			assignee: { id: userId } as Task["assignee"],
			blocks: [{ id: "task-2", status: "to-do" }] as Task["blocks"],
		});
		expect(classifyTask(task, userId, today, weekFromNow)).toBe("blocking");
	});

	test("ignores resolved blocks (done/cancelled)", () => {
		const task = makeTask({
			status: "in-progress",
			assignee: { id: userId } as Task["assignee"],
			blocks: [
				{ id: "task-2", status: "done" },
				{ id: "task-3", status: "cancelled" },
			] as Task["blocks"],
		});
		expect(classifyTask(task, userId, today, weekFromNow)).toBe("in-progress");
	});

	test("returns 'needs-review' for awaiting-review tasks where user is approver", () => {
		const task = makeTask({
			status: "awaiting-review",
			assignee: { id: "other-user" } as Task["assignee"],
			requiredApprovalBy: [
				{ id: userId, name: "Me" },
			] as Task["requiredApprovalBy"],
			approvedBy: [],
		});
		expect(classifyTask(task, userId, today, weekFromNow)).toBe("needs-review");
	});

	test("returns null for needs-review when user already approved", () => {
		const task = makeTask({
			status: "awaiting-review",
			assignee: { id: "other-user" } as Task["assignee"],
			requiredApprovalBy: [
				{ id: userId, name: "Me" },
			] as Task["requiredApprovalBy"],
			approvedBy: [{ id: userId }] as Task["approvedBy"],
		});
		expect(classifyTask(task, userId, today, weekFromNow)).toBeNull();
	});

	test("returns 'due-this-week' for tasks due within 7 days", () => {
		const task = makeTask({
			status: "to-do",
			assignee: { id: userId } as Task["assignee"],
			dueDate: "2026-02-10",
		});
		expect(classifyTask(task, userId, today, weekFromNow)).toBe(
			"due-this-week",
		);
	});

	test("returns 'in-progress' for in-progress tasks assigned to me", () => {
		const task = makeTask({
			status: "in-progress",
			assignee: { id: userId } as Task["assignee"],
		});
		expect(classifyTask(task, userId, today, weekFromNow)).toBe("in-progress");
	});

	test("returns 'to-do' for to-do tasks assigned to me", () => {
		const task = makeTask({
			status: "to-do",
			assignee: { id: userId } as Task["assignee"],
		});
		expect(classifyTask(task, userId, today, weekFromNow)).toBe("to-do");
	});

	test("returns null for tasks not assigned to me (non-review)", () => {
		const task = makeTask({
			status: "to-do",
			assignee: { id: "other-user" } as Task["assignee"],
		});
		expect(classifyTask(task, userId, today, weekFromNow)).toBeNull();
	});

	test("returns null for backlog tasks assigned to me", () => {
		const task = makeTask({
			status: "backlog",
			assignee: { id: userId } as Task["assignee"],
		});
		expect(classifyTask(task, userId, today, weekFromNow)).toBeNull();
	});

	test("overdue takes priority over blocking", () => {
		const task = makeTask({
			status: "in-progress",
			assignee: { id: userId } as Task["assignee"],
			dueDate: "2026-02-04",
			blocks: [{ id: "task-2", status: "to-do" }] as Task["blocks"],
		});
		expect(classifyTask(task, userId, today, weekFromNow)).toBe("overdue");
	});
});

describe("sortTasks", () => {
	test("sorts by priority (urgent first)", () => {
		const urgent = makeTask({ priority: "urgent" });
		const low = makeTask({ priority: "low" });
		expect(sortTasks(urgent, low)).toBeLessThan(0);
		expect(sortTasks(low, urgent)).toBeGreaterThan(0);
	});

	test("sorts by due date when priority is equal", () => {
		const earlier = makeTask({ priority: "medium", dueDate: "2026-02-06" });
		const later = makeTask({ priority: "medium", dueDate: "2026-02-10" });
		expect(sortTasks(earlier, later)).toBeLessThan(0);
		expect(sortTasks(later, earlier)).toBeGreaterThan(0);
	});

	test("tasks with due dates come before tasks without", () => {
		const withDate = makeTask({ priority: "medium", dueDate: "2026-02-06" });
		const withoutDate = makeTask({ priority: "medium", dueDate: null });
		expect(sortTasks(withDate, withoutDate)).toBeLessThan(0);
		expect(sortTasks(withoutDate, withDate)).toBeGreaterThan(0);
	});

	test("returns 0 for equal priority and no due dates", () => {
		const a = makeTask({ priority: "high" });
		const b = makeTask({ priority: "high" });
		expect(sortTasks(a, b)).toBe(0);
	});
});

describe("buildFocusGroups", () => {
	const userId = "user-1";

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-06T12:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test("returns empty array for no tasks", () => {
		expect(buildFocusGroups([], userId)).toEqual([]);
	});

	test("returns empty array when all tasks are done", () => {
		const tasks = [
			makeTask({
				status: "done",
				assignee: { id: userId } as Task["assignee"],
			}),
			makeTask({
				status: "cancelled",
				assignee: { id: userId } as Task["assignee"],
			}),
		];
		expect(buildFocusGroups(tasks, userId)).toEqual([]);
	});

	test("groups are in correct order", () => {
		const tasks = [
			makeTask({
				id: taskId("t1"),
				status: "to-do",
				assignee: { id: userId } as Task["assignee"],
				priority: "medium",
			}),
			makeTask({
				id: taskId("t2"),
				status: "in-progress",
				assignee: { id: userId } as Task["assignee"],
				priority: "medium",
			}),
			makeTask({
				id: taskId("t3"),
				status: "to-do",
				assignee: { id: userId } as Task["assignee"],
				dueDate: "2026-02-04",
				priority: "medium",
			}),
		];
		const groups = buildFocusGroups(tasks, userId);
		const groupNames = groups.map((g) => g.group);
		expect(groupNames).toEqual(["overdue", "in-progress", "to-do"]);
	});

	test("respects MAX_ITEMS (12) limit", () => {
		const tasks = Array.from({ length: 20 }, (_, i) =>
			makeTask({
				id: taskId(`task-${i}`),
				status: "to-do",
				assignee: { id: userId } as Task["assignee"],
				priority: "medium",
			}),
		);
		const groups = buildFocusGroups(tasks, userId);
		const totalItems = groups.reduce((sum, g) => sum + g.tasks.length, 0);
		expect(totalItems).toBeLessThanOrEqual(12);
	});
});

describe("getLatestUpdateStatus", () => {
	test("returns null when no progress updates", () => {
		const comp = makeCompetition({ progressUpdates: [] });
		expect(getLatestUpdateStatus(comp)).toBeNull();
	});

	test("returns the last update", () => {
		const comp = makeCompetition({
			progressUpdates: [
				makeProgressUpdate({ status: "on-track", message: "First" }),
				makeProgressUpdate({ status: "at-risk", message: "Second" }),
			],
		});
		const result = getLatestUpdateStatus(comp);
		expect(result).toEqual({ status: "at-risk", message: "Second" });
	});

	test("handles undefined message", () => {
		const comp = makeCompetition({
			progressUpdates: [
				makeProgressUpdate({ status: "on-track", message: undefined }),
			],
		});
		const result = getLatestUpdateStatus(comp);
		expect(result).toEqual({ status: "on-track", message: "" });
	});
});

describe("getCompetitionDaysText", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-06T12:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test("shows 'in X days' for future competitions", () => {
		expect(getCompetitionDaysText("2026-02-20", "2026-02-21")).toBe(
			"in 14 days",
		);
	});

	test("shows 'Starts tomorrow'", () => {
		expect(getCompetitionDaysText("2026-02-07", "2026-02-08")).toBe(
			"Starts tomorrow",
		);
	});

	test("shows 'Starts today'", () => {
		expect(getCompetitionDaysText("2026-02-06", "2026-02-07")).toBe(
			"Starts today",
		);
	});

	test("shows 'Ends today' when comp started but ends today", () => {
		expect(getCompetitionDaysText("2026-02-05", "2026-02-06")).toBe(
			"Ends today",
		);
	});

	test("shows 'Ends tomorrow'", () => {
		expect(getCompetitionDaysText("2026-02-05", "2026-02-07")).toBe(
			"Ends tomorrow",
		);
	});

	test("shows 'In progress' for running competitions", () => {
		expect(getCompetitionDaysText("2026-02-04", "2026-02-10")).toBe(
			"In progress",
		);
	});

	test("shows 'Ended' for past competitions", () => {
		expect(getCompetitionDaysText("2026-02-01", "2026-02-03")).toBe("Ended");
	});
});

describe("getTaskProgress", () => {
	test("returns 0/0 for no tasks", () => {
		const comp = makeCompetition({ tasks: [] });
		expect(getTaskProgress(comp)).toEqual({ done: 0, total: 0 });
	});

	test("counts done tasks only in current phase", () => {
		const comp = makeCompetition({
			phases: [
				{ id: "phase-a", name: "Phase A", description: "" },
				{ id: "phase-b", name: "Phase B", description: "" },
			] as Competition["phases"],
			currentPhaseIdx: 1,
			tasks: [
				{ status: "done", phaseId: "phase-a" },
				{ status: "to-do", phaseId: "phase-a" },
				{ status: "done", phaseId: "phase-b" },
				{ status: "in-progress", phaseId: "phase-b" },
				{ status: "done" },
			] as Competition["tasks"],
		});
		expect(getTaskProgress(comp)).toEqual({ done: 1, total: 2 });
	});

	test("falls back to all tasks when current phase id is unavailable", () => {
		const comp = makeCompetition({
			tasks: [
				{ status: "done" },
				{ status: "to-do" },
				{ status: "done" },
			] as Competition["tasks"],
		});
		expect(getTaskProgress(comp)).toEqual({ done: 2, total: 3 });
	});
});

describe("getProgressPercent", () => {
	test("returns 0 for 0 total", () => {
		expect(getProgressPercent(0, 0)).toBe(0);
	});

	test("calculates percentage correctly", () => {
		expect(getProgressPercent(3, 10)).toBe(30);
	});

	test("rounds to nearest integer", () => {
		expect(getProgressPercent(1, 3)).toBe(33);
	});

	test("returns 100 for all done", () => {
		expect(getProgressPercent(5, 5)).toBe(100);
	});
});
