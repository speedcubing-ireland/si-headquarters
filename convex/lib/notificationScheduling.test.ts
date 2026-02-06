import { describe, expect, test } from "vitest";
import {
	computeDispatchSchedule,
	validateTimezone,
	validateQuietHoursWindow,
} from "./notificationScheduling";

describe("validateTimezone", () => {
	test("accepts a valid IANA timezone", () => {
		expect(() => validateTimezone("Europe/Dublin")).not.toThrow();
		expect(() => validateTimezone("America/New_York")).not.toThrow();
		expect(() => validateTimezone("UTC")).not.toThrow();
	});

	test("rejects an invalid timezone string", () => {
		expect(() => validateTimezone("Invalid/Timezone")).toThrow();
		expect(() => validateTimezone("")).toThrow();
		expect(() => validateTimezone("NotATimezone")).toThrow();
	});
});

describe("validateQuietHoursWindow", () => {
	test("allows both undefined (no quiet hours)", () => {
		expect(() => validateQuietHoursWindow(undefined, undefined)).not.toThrow();
	});

	test("allows a valid window where start < end", () => {
		expect(() => validateQuietHoursWindow(22 * 60, 7 * 60)).not.toThrow();
	});

	test("allows a valid window wrapping midnight (start > end)", () => {
		expect(() => validateQuietHoursWindow(23 * 60, 6 * 60)).not.toThrow();
	});

	test("throws when only start is provided", () => {
		expect(() => validateQuietHoursWindow(22 * 60, undefined)).toThrow(
			"quiet hours require both",
		);
	});

	test("throws when only end is provided", () => {
		expect(() => validateQuietHoursWindow(undefined, 7 * 60)).toThrow(
			"quiet hours require both",
		);
	});

	test("throws when start equals end", () => {
		expect(() => validateQuietHoursWindow(600, 600)).toThrow(
			"cannot be the same minute",
		);
	});
});

describe("computeDispatchSchedule", () => {
	const TIMEZONE = "Europe/Dublin";

	describe("immediate mode", () => {
		test("returns now when no quiet hours are set", () => {
			const now = Date.now();
			const result = computeDispatchSchedule({
				now,
				timezone: TIMEZONE,
				digestMode: "immediate",
				quietHoursStartMin: undefined,
				quietHoursEndMin: undefined,
			});
			expect(result.scheduledFor).toBe(now);
			expect(result.digestWindowKey).toBeUndefined();
		});

		test("delays past quiet hours if now falls within quiet window", () => {
			// Create a timestamp at 23:30 Dublin time (within 22:00-07:00 quiet hours)
			const date = new Date("2025-01-15T23:30:00.000Z"); // UTC = Dublin in winter
			const now = date.getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: TIMEZONE,
				digestMode: "immediate",
				quietHoursStartMin: 22 * 60, // 22:00
				quietHoursEndMin: 7 * 60, // 07:00
			});

			expect(result.scheduledFor).toBeGreaterThan(now);
			// Should be scheduled at or after 07:00 Dublin time
			const scheduledDate = new Date(result.scheduledFor);
			// In winter, Dublin = UTC, so 07:00 Dublin = 07:00 UTC
			expect(scheduledDate.getUTCHours()).toBe(7);
			expect(scheduledDate.getUTCMinutes()).toBe(0);
		});

		test("sends immediately if outside quiet hours", () => {
			// 12:00 Dublin time, quiet hours 22:00-07:00
			const date = new Date("2025-01-15T12:00:00.000Z");
			const now = date.getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: TIMEZONE,
				digestMode: "immediate",
				quietHoursStartMin: 22 * 60,
				quietHoursEndMin: 7 * 60,
			});

			expect(result.scheduledFor).toBe(now);
		});
	});

	describe("hourly mode", () => {
		test("schedules at the next hour boundary", () => {
			// 14:25 UTC
			const now = new Date("2025-01-15T14:25:00.000Z").getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: TIMEZONE,
				digestMode: "hourly",
				quietHoursStartMin: undefined,
				quietHoursEndMin: undefined,
			});

			// Should schedule at 15:00 (next :00 minute)
			const scheduled = new Date(result.scheduledFor);
			expect(scheduled.getUTCMinutes()).toBe(0);
			expect(result.scheduledFor).toBeGreaterThan(now);
		});

		test("returns a digestWindowKey in YYYY-MM-DDTHH format", () => {
			const now = new Date("2025-01-15T14:25:00.000Z").getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: TIMEZONE,
				digestMode: "hourly",
				quietHoursStartMin: undefined,
				quietHoursEndMin: undefined,
			});

			expect(result.digestWindowKey).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
			// In winter, Dublin = UTC, so 14:25 Dublin => digestWindowKey "2025-01-15T14"
			expect(result.digestWindowKey).toBe("2025-01-15T14");
		});

		test("delays past quiet hours when next hour falls within them", () => {
			// 21:45 Dublin => next hour is 22:00, which is within quiet hours 22:00-07:00
			const now = new Date("2025-01-15T21:45:00.000Z").getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: TIMEZONE,
				digestMode: "hourly",
				quietHoursStartMin: 22 * 60,
				quietHoursEndMin: 7 * 60,
			});

			// Should be pushed to 07:00
			const scheduled = new Date(result.scheduledFor);
			expect(scheduled.getUTCHours()).toBe(7);
			expect(scheduled.getUTCMinutes()).toBe(0);
		});
	});

	describe("daily mode", () => {
		test("schedules at the daily digest send minute (09:00)", () => {
			// 14:25 Dublin time
			const now = new Date("2025-01-15T14:25:00.000Z").getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: TIMEZONE,
				digestMode: "daily",
				quietHoursStartMin: undefined,
				quietHoursEndMin: undefined,
			});

			// DAILY_DIGEST_SEND_MINUTE = 9 * 60 = 540 => 09:00
			// Since it's 14:25, next 09:00 is tomorrow
			const scheduled = new Date(result.scheduledFor);
			expect(scheduled.getUTCHours()).toBe(9);
			expect(scheduled.getUTCMinutes()).toBe(0);
			expect(result.scheduledFor).toBeGreaterThan(now);
		});

		test("returns a digestWindowKey in YYYY-MM-DD format", () => {
			const now = new Date("2025-01-15T14:25:00.000Z").getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: TIMEZONE,
				digestMode: "daily",
				quietHoursStartMin: undefined,
				quietHoursEndMin: undefined,
			});

			expect(result.digestWindowKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(result.digestWindowKey).toBe("2025-01-15");
		});

		test("schedules same-day if before the daily digest time", () => {
			// 08:00 Dublin time => earlier than 09:00 digest time
			const now = new Date("2025-01-15T08:00:00.000Z").getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: TIMEZONE,
				digestMode: "daily",
				quietHoursStartMin: undefined,
				quietHoursEndMin: undefined,
			});

			const scheduled = new Date(result.scheduledFor);
			expect(scheduled.getUTCHours()).toBe(9);
			expect(scheduled.getUTCMinutes()).toBe(0);
			// Should be on the same day
			expect(scheduled.getUTCDate()).toBe(15);
		});
	});

	describe("three_daily mode", () => {
		test("schedules to the next 09:00/13:00/18:00 slot", () => {
			// 10:15 Dublin time -> next slot should be 13:00
			const now = new Date("2025-01-15T10:15:00.000Z").getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: TIMEZONE,
				digestMode: "three_daily",
				quietHoursStartMin: undefined,
				quietHoursEndMin: undefined,
			});

			const scheduled = new Date(result.scheduledFor);
			expect(scheduled.getUTCHours()).toBe(13);
			expect(scheduled.getUTCMinutes()).toBe(0);
			expect(result.digestWindowKey).toBe("2025-01-15T13");
		});

		test("rolls to next day when past the last slot", () => {
			// 19:05 Dublin time -> next slot should be 09:00 next day
			const now = new Date("2025-01-15T19:05:00.000Z").getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: TIMEZONE,
				digestMode: "three_daily",
				quietHoursStartMin: undefined,
				quietHoursEndMin: undefined,
			});

			const scheduled = new Date(result.scheduledFor);
			expect(scheduled.getUTCHours()).toBe(9);
			expect(scheduled.getUTCMinutes()).toBe(0);
			expect(scheduled.getUTCDate()).toBe(16);
			expect(result.digestWindowKey).toBe("2025-01-16T09");
		});
	});

	describe("timezone handling", () => {
		test("works with America/New_York timezone", () => {
			// 2025-01-15T05:00:00Z = midnight EST (UTC-5 in winter)
			const now = new Date("2025-01-15T05:00:00.000Z").getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: "America/New_York",
				digestMode: "daily",
				quietHoursStartMin: undefined,
				quietHoursEndMin: undefined,
			});

			// Daily digest at 09:00 local EST = 14:00 UTC
			const scheduled = new Date(result.scheduledFor);
			expect(scheduled.getUTCHours()).toBe(14);
			expect(scheduled.getUTCMinutes()).toBe(0);
		});

		test("uses correct local time for quiet hours across timezones", () => {
			// 03:00 UTC on Jan 15 = 22:00 EST on Jan 14 (within quiet hours 22:00-07:00)
			const now = new Date("2025-01-15T03:00:00.000Z").getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: "America/New_York",
				digestMode: "immediate",
				quietHoursStartMin: 22 * 60,
				quietHoursEndMin: 7 * 60,
			});

			// Should delay to 07:00 EST = 12:00 UTC
			const scheduled = new Date(result.scheduledFor);
			expect(scheduled.getUTCHours()).toBe(12);
			expect(scheduled.getUTCMinutes()).toBe(0);
		});
	});

	describe("quiet hours edge cases", () => {
		test("handles quiet hours that do not wrap midnight (e.g. 13:00-15:00)", () => {
			// 14:00 Dublin, quiet hours 13:00-15:00
			const now = new Date("2025-01-15T14:00:00.000Z").getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: TIMEZONE,
				digestMode: "immediate",
				quietHoursStartMin: 13 * 60,
				quietHoursEndMin: 15 * 60,
			});

			// Should delay to 15:00
			const scheduled = new Date(result.scheduledFor);
			expect(scheduled.getUTCHours()).toBe(15);
			expect(scheduled.getUTCMinutes()).toBe(0);
		});

		test("does not delay when exactly at the end of quiet hours", () => {
			// 07:00 Dublin exactly, quiet hours 22:00-07:00
			const now = new Date("2025-01-15T07:00:00.000Z").getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: TIMEZONE,
				digestMode: "immediate",
				quietHoursStartMin: 22 * 60,
				quietHoursEndMin: 7 * 60,
			});

			// 07:00 is NOT within quiet hours (endMin is exclusive), so no delay
			expect(result.scheduledFor).toBe(now);
		});

		test("delays when exactly at the start of quiet hours", () => {
			// 22:00 Dublin exactly, quiet hours 22:00-07:00
			const now = new Date("2025-01-15T22:00:00.000Z").getTime();

			const result = computeDispatchSchedule({
				now,
				timezone: TIMEZONE,
				digestMode: "immediate",
				quietHoursStartMin: 22 * 60,
				quietHoursEndMin: 7 * 60,
			});

			// 22:00 IS within quiet hours (startMin is inclusive), so should delay
			expect(result.scheduledFor).toBeGreaterThan(now);
		});
	});
});
