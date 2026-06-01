import { describe, expect, test } from "vitest";
import {
	formatDate,
	formatDateRange,
} from "./competition-summary-format";

const irishDate = (iso: string) =>
	new Date(iso).toLocaleDateString("en-IE", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "Europe/Dublin",
	});

describe("formatDate", () => {
	test("formats a valid ISO date in Irish locale", () => {
		expect(formatDate("2026-01-31")).toBe(irishDate("2026-01-31"));
	});

	test("day appears before month (not American order)", () => {
		// 2026-01-31 → should start with "31", not "Jan" or "1/"
		const result = formatDate("2026-01-31");
		expect(result.startsWith("31")).toBe(true);
		expect(result).not.toMatch(/^Jan/);
		expect(result).not.toContain("1/31");
	});

	test("returns TBC for empty string", () => {
		expect(formatDate("")).toBe("TBC");
	});

	test("returns TBC for whitespace-only string", () => {
		expect(formatDate("   ")).toBe("TBC");
	});

	test("returns original string for an invalid date", () => {
		expect(formatDate("not-a-date")).toBe("not-a-date");
	});
});

describe("formatDateRange", () => {
	const base = {
		name: "Test",
		address: "Dublin",
		competitorLimit: 100,
		eventIds: [],
	};

	test("returns a single date when start equals end", () => {
		const result = formatDateRange({
			...base,
			startDate: "2026-01-31",
			endDate: "2026-01-31",
		});
		expect(result).toBe(irishDate("2026-01-31"));
		expect(result).not.toContain(" to ");
	});

	test("returns range string when start differs from end", () => {
		const result = formatDateRange({
			...base,
			startDate: "2026-01-31",
			endDate: "2026-02-01",
		});
		expect(result).toContain(" to ");
		expect(result).not.toContain("/");
	});
});
