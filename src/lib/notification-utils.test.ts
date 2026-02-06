import { describe, expect, test } from "vitest";
import {
	isNotificationType,
	isDigestMode,
	minutesToTimeInput,
	timeInputToMinutes,
} from "./notification-utils";

describe("isNotificationType", () => {
	test("returns true for valid notification types", () => {
		expect(isNotificationType("task_assigned")).toBe(true);
		expect(isNotificationType("task_priority_changed")).toBe(true);
		expect(isNotificationType("comment_added")).toBe(true);
		expect(isNotificationType("comment_replied")).toBe(true);
		expect(isNotificationType("due_date_overdue")).toBe(true);
		expect(isNotificationType("reminder_triggered")).toBe(true);
	});

	test("returns false for invalid types", () => {
		expect(isNotificationType("invalid_type")).toBe(false);
		expect(isNotificationType("")).toBe(false);
		expect(isNotificationType("TASK_ASSIGNED")).toBe(false);
	});
});

describe("isDigestMode", () => {
	test("returns true for valid digest modes", () => {
		expect(isDigestMode("immediate")).toBe(true);
		expect(isDigestMode("hourly")).toBe(true);
		expect(isDigestMode("daily")).toBe(true);
		expect(isDigestMode("three_daily")).toBe(true);
	});

	test("returns false for invalid modes", () => {
		expect(isDigestMode("weekly")).toBe(false);
		expect(isDigestMode("")).toBe(false);
	});
});

describe("minutesToTimeInput", () => {
	test("converts midnight (0 minutes)", () => {
		expect(minutesToTimeInput(0)).toBe("00:00");
	});

	test("converts morning time", () => {
		expect(minutesToTimeInput(9 * 60 + 30)).toBe("09:30");
	});

	test("converts afternoon time", () => {
		expect(minutesToTimeInput(14 * 60 + 5)).toBe("14:05");
	});

	test("converts end of day", () => {
		expect(minutesToTimeInput(23 * 60 + 59)).toBe("23:59");
	});

	test("returns empty string for undefined", () => {
		expect(minutesToTimeInput(undefined)).toBe("");
	});
});

describe("timeInputToMinutes", () => {
	test("parses midnight", () => {
		expect(timeInputToMinutes("00:00")).toBe(0);
	});

	test("parses morning time", () => {
		expect(timeInputToMinutes("09:30")).toBe(570);
	});

	test("parses afternoon time", () => {
		expect(timeInputToMinutes("14:05")).toBe(845);
	});

	test("parses end of day", () => {
		expect(timeInputToMinutes("23:59")).toBe(1439);
	});

	test("returns undefined for empty string", () => {
		expect(timeInputToMinutes("")).toBeUndefined();
	});

	test("returns undefined for missing colon parts", () => {
		expect(timeInputToMinutes("14")).toBeUndefined();
		expect(timeInputToMinutes(":30")).toBeUndefined();
	});

	test("returns undefined for out of range hours", () => {
		expect(timeInputToMinutes("24:00")).toBeUndefined();
		expect(timeInputToMinutes("-1:00")).toBeUndefined();
	});

	test("returns undefined for out of range minutes", () => {
		expect(timeInputToMinutes("12:60")).toBeUndefined();
		expect(timeInputToMinutes("12:-1")).toBeUndefined();
	});

	test("returns undefined for non-numeric input", () => {
		expect(timeInputToMinutes("ab:cd")).toBeUndefined();
	});

	test("roundtrips with minutesToTimeInput", () => {
		for (const minutes of [0, 1, 60, 570, 845, 1439]) {
			expect(timeInputToMinutes(minutesToTimeInput(minutes))).toBe(minutes);
		}
	});
});
