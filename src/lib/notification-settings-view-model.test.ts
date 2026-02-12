import { describe, expect, test } from "vitest";
import type { NotificationType } from "@/data/types-new";
import {
	buildPreferenceRows,
	deriveEmailBulkState,
	deriveSubscriptionBulkState,
	filterPreferenceRows,
	filterSubscriptions,
	type PreferenceSource,
	type SubscriptionSource,
	transitionSaveState,
} from "./notification-settings-view-model";

function preference(
	type: NotificationType,
	channel: PreferenceSource["channel"],
	enabled: boolean,
	overrides?: Partial<PreferenceSource>,
): PreferenceSource {
	return {
		type,
		channel,
		enabled,
		isOverride: false,
		respectQuietHours: true,
		...overrides,
	};
}

function subscription(
	overrides: Partial<SubscriptionSource>,
): SubscriptionSource {
	return {
		id: "sub_1",
		label: "Task updates",
		description: "Task #123",
		entityType: "task",
		isStale: false,
		...overrides,
	};
}

describe("buildPreferenceRows", () => {
	test("sorts by catalog order and splits channels", () => {
		const { emailRows, inAppRows } = buildPreferenceRows([
			preference("task_unassigned", "email", true),
			preference("task_assigned", "email", false),
			preference("due_date_overdue", "in_app", true),
		]);

		expect(emailRows.map((row) => row.type)).toEqual([
			"task_assigned",
			"task_unassigned",
		]);
		expect(inAppRows.map((row) => row.type)).toEqual(["due_date_overdue"]);
	});
});

describe("filterPreferenceRows", () => {
	test("filters case-insensitively by label", () => {
		const { emailRows } = buildPreferenceRows([
			preference("comment_added", "email", true),
			preference("task_assigned", "email", false),
		]);
		expect(filterPreferenceRows(emailRows, "comment")).toHaveLength(1);
		expect(filterPreferenceRows(emailRows, "COMMENT")).toHaveLength(1);
		expect(filterPreferenceRows(emailRows, "")).toHaveLength(2);
	});
});

describe("deriveEmailBulkState", () => {
	test("returns total, enabled, disabled and action flags", () => {
		const { emailRows } = buildPreferenceRows([
			preference("task_assigned", "email", true),
			preference("task_unassigned", "email", false),
		]);
		expect(deriveEmailBulkState(emailRows)).toEqual({
			total: 2,
			enabledCount: 1,
			disabledCount: 1,
			canEnableAll: true,
			canDisableAll: true,
		});
	});
});

describe("filterSubscriptions", () => {
	test("applies stale/active filter and text query", () => {
		const allSubscriptions = [
			subscription({
				id: "sub_1",
				label: "Task updates",
				isStale: false,
			}),
			subscription({
				id: "sub_2",
				label: "Competition phase",
				isStale: true,
			}),
		];

		expect(filterSubscriptions(allSubscriptions, "all", "")).toHaveLength(2);
		expect(filterSubscriptions(allSubscriptions, "active", "")).toHaveLength(1);
		expect(filterSubscriptions(allSubscriptions, "stale", "")).toHaveLength(1);
		expect(filterSubscriptions(allSubscriptions, "all", "phase")).toEqual([
			allSubscriptions[1],
		]);
	});
});

describe("deriveSubscriptionBulkState", () => {
	test("returns stale and active counts", () => {
		const result = deriveSubscriptionBulkState([
			subscription({
				id: "sub_1",
				isStale: false,
			}),
			subscription({
				id: "sub_2",
				isStale: true,
			}),
		]);

		expect(result).toEqual({
			total: 2,
			staleCount: 1,
			activeCount: 1,
			canCleanupStale: true,
		});
	});
});

describe("transitionSaveState", () => {
	test("transitions across start/succeed/fail/reset", () => {
		expect(transitionSaveState("idle", "start")).toBe("saving");
		expect(transitionSaveState("saving", "succeed")).toBe("saved");
		expect(transitionSaveState("saving", "fail")).toBe("error");
		expect(transitionSaveState("error", "reset")).toBe("idle");
	});
});
