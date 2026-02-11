import { describe, expect, it } from "vitest";

const EVENT_NAME_TO_ID: Record<string, string> = {
	"3x3": "333",
	"2x2": "222",
	"4x4": "444",
	"5x5": "555",
	"6x6": "666",
	"7x7": "777",
	"3x3 blindfolded": "333bf",
	"3x3 fewest moves": "333fm",
	"3x3 one-handed": "333oh",
	clock: "clock",
	megaminx: "minx",
	pyraminx: "pyram",
	skewb: "skewb",
	"square-1": "sq1",
	"4x4 blindfolded": "444bf",
	"5x5 blindfolded": "555bf",
	"3x3 multi-blind": "333mbf",
};

const STANDARD_OTHER_ACTIVITIES: Record<string, string> = {
	registration: "other-registration",
	"registration opens": "other-registration",
	"registration open": "other-registration",
	"check in": "other-checkin",
	"check-in": "other-checkin",
	checkin: "other-checkin",
	"check-in opens": "other-checkin",
	"check-in closes": "other-checkin",

	lunch: "other-lunch",
	dinner: "other-dinner",
	breakfast: "other-breakfast",
	"coffee break": "other-misc-coffee-break",

	awards: "other-awards",
	"awards ceremony": "other-awards",
	"closing ceremony": "other-awards",
	"opening ceremony": "other-misc-opening-ceremony",
	ceremony: "other-misc-ceremony",

	"intro to competing": "other-tutorial",
	"competitor tutorial": "other-tutorial",
	"new competitor tutorial": "other-tutorial",
	briefing: "other-tutorial",
	"judges briefing": "other-tutorial",
	"scramblers briefing": "other-tutorial",

	break: "other-misc-break",
	setup: "other-setup",
	teardown: "other-teardown",
};

const MULTI_ATTEMPT_EVENTS = new Set(["333fm", "333mbf"]);

function getRoundFormat(
	eventId: string,
	attemptCount: number,
): "1" | "2" | "3" | "a" | "m" {
	if (eventId === "333fm") {
		if (attemptCount >= 3) return "m";
		if (attemptCount === 2) return "2";
		return "3";
	}

	if (eventId === "333mbf") {
		if (attemptCount >= 3) return "3";
		if (attemptCount === 2) return "2";
		return "3";
	}

	if (eventId === "333bf") return "3";

	if (eventId === "666" || eventId === "777") return "m";

	if (eventId === "444bf" || eventId === "555bf") return "3";

	return "a";
}

function normalizeEventName(name: string): string {
	return name.trim().toLowerCase();
}

function eventNameToActivityCode(name: string, round: number): string | null {
	const normalized = normalizeEventName(name);
	const id = EVENT_NAME_TO_ID[normalized];
	if (!id) return null;
	return `${id}-r${round}`;
}

function isOtherActivity(name: string): boolean {
	const normalized = normalizeEventName(name);
	return !EVENT_NAME_TO_ID[normalized];
}

function otherActivityCode(name: string): string {
	const normalized = normalizeEventName(name);

	if (STANDARD_OTHER_ACTIVITIES[normalized]) {
		return STANDARD_OTHER_ACTIVITIES[normalized];
	}

	const suffix = normalized
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-+/g, "-");
	return suffix ? `other-misc-${suffix}` : "other-misc";
}

describe("Schedule Activity Name Mapping", () => {
	describe("Event Names", () => {
		it("should map exact event names", () => {
			expect(eventNameToActivityCode("3x3", 1)).toBe("333-r1");
			expect(eventNameToActivityCode("2x2", 2)).toBe("222-r2");
			expect(eventNameToActivityCode("Pyraminx", 1)).toBe("pyram-r1");
		});

		it("should be case-insensitive", () => {
			expect(eventNameToActivityCode("3X3", 1)).toBe("333-r1");
			expect(eventNameToActivityCode("CLOCK", 1)).toBe("clock-r1");
			expect(eventNameToActivityCode("Square-1", 1)).toBe("sq1-r1");
			expect(eventNameToActivityCode("3x3 One-Handed", 1)).toBe("333oh-r1");
		});

		it("should return null for non-event names", () => {
			expect(eventNameToActivityCode("Registration Opens", 1)).toBeNull();
			expect(eventNameToActivityCode("Lunch (Sat)", 1)).toBeNull();
		});
	});

	describe("Other Activities", () => {
		it("should identify other activities correctly", () => {
			expect(isOtherActivity("Registration Opens")).toBe(true);
			expect(isOtherActivity("Lunch (Sat)")).toBe(true);
			expect(isOtherActivity("Awards")).toBe(true);
			expect(isOtherActivity("3x3")).toBe(false);
		});

		it("should map Registration Opens to standard code", () => {
			expect(otherActivityCode("Registration Opens")).toBe(
				"other-registration",
			);
		});

		it("should map Lunch to standard code", () => {
			expect(otherActivityCode("LUNCH")).toBe("other-lunch");
		});

		it("should fall back to other-misc for lunch variants with qualifiers", () => {
			expect(otherActivityCode("Lunch (Sat)")).toBe("other-misc-lunch-sat");
			expect(otherActivityCode("Lunch (Sun)")).toBe("other-misc-lunch-sun");
			expect(otherActivityCode("Lunch (Saturday)")).toBe(
				"other-misc-lunch-saturday",
			);
			expect(otherActivityCode("Lunch (Sunday)")).toBe(
				"other-misc-lunch-sunday",
			);
		});

		it("should map Awards to standard code", () => {
			expect(otherActivityCode("Awards")).toBe("other-awards");
			expect(otherActivityCode("Awards Ceremony")).toBe("other-awards");
		});

		it("should map Intro to Competing to standard code", () => {
			expect(otherActivityCode("Intro to competing")).toBe("other-tutorial");
		});

		it("should handle check-in variations", () => {
			expect(otherActivityCode("Check-in")).toBe("other-checkin");
			expect(otherActivityCode("Check in")).toBe("other-checkin");
			expect(otherActivityCode("Checkin")).toBe("other-checkin");
		});

		it("should fall back to sanitized custom code for unknown activities", () => {
			expect(otherActivityCode("Custom Activity")).toBe(
				"other-misc-custom-activity",
			);
			expect(otherActivityCode("My Special Event")).toBe(
				"other-misc-my-special-event",
			);
		});
	});

	describe("Round Format Selection", () => {
		it("should return correct format for FMC based on attempt count", () => {
			expect(getRoundFormat("333fm", 1)).toBe("3");
			expect(getRoundFormat("333fm", 2)).toBe("2");
			expect(getRoundFormat("333fm", 3)).toBe("m");
		});

		it("should return correct format for MBLD based on attempt count", () => {
			expect(getRoundFormat("333mbf", 1)).toBe("3");
			expect(getRoundFormat("333mbf", 2)).toBe("2");
			expect(getRoundFormat("333mbf", 3)).toBe("3");
		});

		it("should return correct format for 333bf (Bo5)", () => {
			expect(getRoundFormat("333bf", 1)).toBe("3");
		});

		it("should return correct format for 6x6 and 7x7 (mo3)", () => {
			expect(getRoundFormat("666", 1)).toBe("m");
			expect(getRoundFormat("777", 1)).toBe("m");
		});

		it("should return correct format for big BLD events", () => {
			expect(getRoundFormat("444bf", 1)).toBe("3");
			expect(getRoundFormat("555bf", 1)).toBe("3");
		});

		it("should return average of 5 for regular events", () => {
			expect(getRoundFormat("333", 1)).toBe("a");
			expect(getRoundFormat("222", 1)).toBe("a");
			expect(getRoundFormat("444", 1)).toBe("a");
		});
	});

	describe("Multi-Attempt Event Detection", () => {
		it("should identify FMC and MBLD as multi-attempt events", () => {
			expect(MULTI_ATTEMPT_EVENTS.has("333fm")).toBe(true);
			expect(MULTI_ATTEMPT_EVENTS.has("333mbf")).toBe(true);
			expect(MULTI_ATTEMPT_EVENTS.has("333")).toBe(false);
			expect(MULTI_ATTEMPT_EVENTS.has("333bf")).toBe(false);
		});
	});

	describe("UCD Cube Days 2026 Sample Data", () => {
		const testCases = [
			{ input: "3x3", round: 4, expected: "333-r4" },
			{ input: "2x2", round: 3, expected: "222-r3" },
			{ input: "Pyraminx", round: 1, expected: "pyram-r1" },
			{ input: "Clock", round: 1, expected: "clock-r1" },
			{ input: "Square-1", round: 2, expected: "sq1-r2" },
			{ input: "Megaminx", round: 1, expected: "minx-r1" },
			{ input: "Skewb", round: 2, expected: "skewb-r2" },
			{ input: "Registration Opens", round: 1, expected: "other-registration" },
			{ input: "Intro to competing", round: 1, expected: "other-tutorial" },
			{ input: "Lunch (Sat)", round: 1, expected: "other-misc-lunch-sat" },
			{ input: "Lunch (Sun)", round: 1, expected: "other-misc-lunch-sun" },
			{ input: "Awards", round: 1, expected: "other-awards" },
		];

		testCases.forEach(({ input, round, expected }) => {
			it(`should map "${input}" round ${round} to "${expected}"`, () => {
				if (isOtherActivity(input)) {
					expect(otherActivityCode(input)).toBe(expected);
				} else {
					expect(eventNameToActivityCode(input, round)).toBe(expected);
				}
			});
		});
	});
});
