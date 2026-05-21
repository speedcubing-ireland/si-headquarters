import { describe, expect, test } from "vitest";
import {
	formatDaysText,
	getPriorityFromTaskPriority,
	NotificationTemplates,
} from "./notificationTemplates";
import type { Id } from "../../_generated/dataModel";

const taskId = (id: string) => id as Id<"tasks">;
const competitionId = (id: string) => id as Id<"competitions">;

const baseTask = {
	_id: taskId("t1"),
	identifier: "SI-42",
	title: "Fix registration",
	priority: "medium" as const,
};

const actor = {
	actorId: "u1" as Id<"users">,
	actorName: "Alice",
	actorAvatarUrl: "https://example.com/alice.png",
};

describe("formatDaysText", () => {
	test("singular for 1 day", () => {
		expect(formatDaysText(1)).toBe("1 day");
	});

	test("plural for 0 days", () => {
		expect(formatDaysText(0)).toBe("0 days");
	});

	test("plural for multiple days", () => {
		expect(formatDaysText(3)).toBe("3 days");
	});
});

describe("getPriorityFromTaskPriority", () => {
	test("maps urgent to urgent", () => {
		expect(getPriorityFromTaskPriority("urgent")).toBe("urgent");
	});

	test("maps high to high", () => {
		expect(getPriorityFromTaskPriority("high")).toBe("high");
	});

	test("maps medium to normal", () => {
		expect(getPriorityFromTaskPriority("medium")).toBe("normal");
	});

	test("maps low to normal", () => {
		expect(getPriorityFromTaskPriority("low")).toBe("normal");
	});
});

describe("NotificationTemplates", () => {
	describe("task_assigned", () => {
		test("includes task identifier and actor name", () => {
			const result = NotificationTemplates.task_assigned(baseTask, actor);
			expect(result.title).toBe("Assigned to SI-42: Fix registration");
			expect(result.message).toContain("Alice");
			expect(result.message).toContain("SI-42");
			expect(result.message).toContain("Fix registration");
			expect(result.entityType).toBe("task");
		});

		test("uses 'Someone' when actor name is missing", () => {
			const result = NotificationTemplates.task_assigned(baseTask, {});
			expect(result.message).toContain("Someone");
		});

		test("priority maps from task priority", () => {
			const urgentTask = { ...baseTask, priority: "urgent" as const };
			expect(
				NotificationTemplates.task_assigned(urgentTask, actor).priority,
			).toBe("urgent");

			const highTask = { ...baseTask, priority: "high" as const };
			expect(
				NotificationTemplates.task_assigned(highTask, actor).priority,
			).toBe("high");

			expect(
				NotificationTemplates.task_assigned(baseTask, actor).priority,
			).toBe("normal");
		});
	});

	describe("task_unassigned", () => {
		test("includes task identifier and is always normal priority", () => {
			const result = NotificationTemplates.task_unassigned(baseTask, actor);
			expect(result.title).toBe("Unassigned from SI-42: Fix registration");
			expect(result.priority).toBe("normal");
		});
	});

	describe("task_mentioned", () => {
		test("sets entityType to comment and includes parentTaskId", () => {
			const result = NotificationTemplates.task_mentioned(baseTask, actor);
			expect(result.entityType).toBe("comment");
			expect(result.parentTaskId).toBe(baseTask._id);
			expect(result.title).toBe("Mentioned in SI-42: Fix registration");
		});
	});

	describe("comment_added", () => {
		test("sets entityType to comment and includes parentTaskId", () => {
			const result = NotificationTemplates.comment_added(baseTask, actor);
			expect(result.entityType).toBe("comment");
			expect(result.parentTaskId).toBe(baseTask._id);
		});
	});

	describe("comment_replied", () => {
		test("sets entityType to comment and includes parentTaskId", () => {
			const result = NotificationTemplates.comment_replied(baseTask, actor);
			expect(result.entityType).toBe("comment");
			expect(result.parentTaskId).toBe(baseTask._id);
			expect(result.title).toBe("New reply on SI-42: Fix registration");
		});
	});

	describe("task_status_changed", () => {
		test("includes old and new status in message and metadata", () => {
			const result = NotificationTemplates.task_status_changed(
				baseTask,
				actor,
				"backlog",
				"in_progress",
			);
			expect(result.title).toBe(
				"SI-42: Fix registration \u2014 status changed",
			);
			expect(result.metadata?.oldValue).toBe("backlog");
			expect(result.metadata?.newValue).toBe("in_progress");
		});
	});

	describe("task_priority_changed", () => {
		test("includes old and new priority in metadata", () => {
			const result = NotificationTemplates.task_priority_changed(
				baseTask,
				actor,
				"low",
				"urgent",
			);
			expect(result.title).toBe(
				"SI-42: Fix registration \u2014 priority changed",
			);
			expect(result.metadata?.oldValue).toBe("low");
			expect(result.metadata?.newValue).toBe("urgent");
		});
	});

	describe("relation_blocked", () => {
		test("includes both blocked and blocking task info", () => {
			const blockingTask = {
				...baseTask,
				_id: taskId("t2"),
				identifier: "SI-99",
				title: "Deploy infra",
			};
			const result = NotificationTemplates.relation_blocked(
				baseTask,
				blockingTask,
				actor,
			);
			expect(result.title).toBe("SI-42: Fix registration \u2014 blocked");
			expect(result.message).toContain("SI-99");
			expect(result.priority).toBe("high");
		});
	});

	describe("relation_unblocked", () => {
		test("includes both task identifiers and is normal priority", () => {
			const blockingTask = {
				...baseTask,
				_id: taskId("t2"),
				identifier: "SI-99",
				title: "Deploy infra",
			};
			const result = NotificationTemplates.relation_unblocked(
				baseTask,
				blockingTask,
				actor,
			);
			expect(result.title).toBe("SI-42: Fix registration \u2014 unblocked");
			expect(result.priority).toBe("normal");
		});
	});

	describe("task_approved", () => {
		test("includes task identifier and actor name", () => {
			const result = NotificationTemplates.task_approved(baseTask, actor);
			expect(result.title).toBe("SI-42: Fix registration \u2014 approved");
			expect(result.message).toContain("Alice");
			expect(result.message).toContain("SI-42");
			expect(result.message).toContain("Fix registration");
			expect(result.entityType).toBe("task");
			expect(result.priority).toBe("normal");
		});

		test("uses 'Someone' when actor name is missing", () => {
			const result = NotificationTemplates.task_approved(baseTask, {});
			expect(result.message).toContain("Someone");
		});
	});

	describe("task_unapproved", () => {
		test("includes task identifier and actor name", () => {
			const result = NotificationTemplates.task_unapproved(baseTask, actor);
			expect(result.title).toBe(
				"SI-42: Fix registration \u2014 approval withdrawn",
			);
			expect(result.message).toContain("Alice");
			expect(result.message).toContain("SI-42");
			expect(result.entityType).toBe("task");
			expect(result.priority).toBe("normal");
		});
	});

	describe("due_date_changed", () => {
		test("includes old and new dates in metadata", () => {
			const result = NotificationTemplates.due_date_changed(
				baseTask,
				actor,
				"2025-01-01",
				"2025-02-01",
			);
			expect(result.title).toBe(
				"SI-42: Fix registration \u2014 due date changed",
			);
			expect(result.message).toContain(
				"changed due date from 2025-01-01 to 2025-02-01",
			);
			expect(result.metadata?.oldValue).toBe("2025-01-01");
			expect(result.metadata?.newValue).toBe("2025-02-01");
			expect(result.entityType).toBe("task");
			expect(result.priority).toBe("normal");
		});

		test("handles setting a due date for the first time", () => {
			const result = NotificationTemplates.due_date_changed(
				baseTask,
				actor,
				undefined,
				"2025-03-15",
			);
			expect(result.message).toContain("set due date to 2025-03-15");
		});

		test("handles removing a due date", () => {
			const result = NotificationTemplates.due_date_changed(
				baseTask,
				actor,
				"2025-03-15",
				undefined,
			);
			expect(result.message).toContain("removed due date");
		});
	});

	describe("due_date_approaching", () => {
		test("high priority when 1 day or less", () => {
			const result = NotificationTemplates.due_date_approaching(baseTask, 1);
			expect(result.priority).toBe("high");
			expect(result.message).toContain("1 day");
			expect(result.isBatchable).toBe(true);
			expect(result.batchKey).toBe(`due_date_${baseTask._id}`);
		});

		test("normal priority when more than 1 day", () => {
			const result = NotificationTemplates.due_date_approaching(baseTask, 3);
			expect(result.priority).toBe("normal");
			expect(result.message).toContain("3 days");
		});
	});

	describe("due_date_overdue", () => {
		test("always urgent priority", () => {
			const result = NotificationTemplates.due_date_overdue(baseTask, 2);
			expect(result.priority).toBe("urgent");
			expect(result.message).toContain("2 days overdue");
			expect(result.isBatchable).toBe(true);
		});
	});

	describe("competition_phase_changed", () => {
		test("includes competition name and phase info", () => {
			const comp = { _id: competitionId("c1"), name: "Cork Open 2025" };
			const result = NotificationTemplates.competition_phase_changed(
				comp,
				actor,
				"planning",
				"registration",
			);
			expect(result.title).toBe("Cork Open 2025 phase changed");
			expect(result.entityType).toBe("competition");
			expect(result.metadata?.oldValue).toBe("planning");
			expect(result.metadata?.newValue).toBe("registration");
		});
	});

	describe("progress_update_added", () => {
		test("includes competition name and status", () => {
			const comp = { _id: competitionId("c1"), name: "Cork Open 2025" };
			const result = NotificationTemplates.progress_update_added(
				comp,
				actor,
				"on_track",
			);
			expect(result.title).toBe("Progress update: Cork Open 2025");
			expect(result.entityType).toBe("competition");
		});
	});

	describe("reminder_triggered", () => {
		test("uses provided message", () => {
			const result = NotificationTemplates.reminder_triggered(
				taskId("t1"),
				"Don't forget!",
			);
			expect(result.message).toBe("Don't forget!");
			expect(result.entityType).toBe("reminder");
			expect(result.parentTaskId).toBe(taskId("t1"));
		});

		test("falls back to default message when none provided", () => {
			const result = NotificationTemplates.reminder_triggered(taskId("t1"));
			expect(result.message).toContain("t1");
		});

		test("uses task identifier and title when TaskInfo provided", () => {
			const result = NotificationTemplates.reminder_triggered(
				baseTask,
				"Don't forget!",
			);
			expect(result.title).toBe("Reminder: SI-42: Fix registration");
			expect(result.message).toBe("Don't forget!");
			expect(result.parentTaskId).toBe(baseTask._id);
		});

		test("uses task info in default message when TaskInfo provided", () => {
			const result = NotificationTemplates.reminder_triggered(baseTask);
			expect(result.title).toBe("Reminder: SI-42: Fix registration");
			expect(result.message).toBe("Reminder for SI-42: Fix registration");
		});
	});
});
