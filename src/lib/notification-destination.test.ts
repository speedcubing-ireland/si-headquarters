import { describe, expect, test } from "vitest";
import { getNotificationDestination } from "./notification-destination";

describe("getNotificationDestination", () => {
	test("returns task destination for task entity", () => {
		expect(
			getNotificationDestination({
				entityType: "task",
				entityId: "task_1",
			}),
		).toEqual({ to: "/tasks/$id", params: { id: "task_1" } });
	});

	test("returns competition destination for competition entity", () => {
		expect(
			getNotificationDestination({
				entityType: "competition",
				entityId: "comp_1",
			}),
		).toEqual({ to: "/competitions/$id", params: { id: "comp_1" } });
	});

	test("returns parent task destination for comment/reminder entities", () => {
		expect(
			getNotificationDestination({
				entityType: "comment",
				entityId: "comment_1",
				parentEntityId: "task_10",
			}),
		).toEqual({ to: "/tasks/$id", params: { id: "task_10" } });
	});

	test("returns null when comment/reminder has no parent", () => {
		expect(
			getNotificationDestination({
				entityType: "comment",
				entityId: "comment_2",
			}),
		).toBeNull();
	});

	test("returns null for unsupported entity types", () => {
		expect(
			getNotificationDestination({
				entityType: "other",
				entityId: "x",
			}),
		).toBeNull();
	});
});
