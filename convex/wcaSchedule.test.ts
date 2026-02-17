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

type OtherActivityDef = {
	activityCode: string;
	displayName: string;
};

const OTHER_ACTIVITIES: Record<string, OtherActivityDef> = {
	"intro to competing": {
		activityCode: "other-tutorial",
		displayName: "Tutorial for new competitors",
	},
	awards: {
		activityCode: "other-awards",
		displayName: "Awards",
	},
	"registration opens": {
		activityCode: "other-checkin",
		displayName: "Check-in",
	},
	lunch: {
		activityCode: "other-lunch",
		displayName: "Lunch",
	},
	"lunch (sat)": {
		activityCode: "other-lunch",
		displayName: "Lunch",
	},
	"lunch (sun)": {
		activityCode: "other-lunch",
		displayName: "Lunch",
	},
};

const MULTI_ATTEMPT_EVENTS = new Set(["333fm", "333mbf"]);

function getRoundFormat(
	eventId: string,
	attemptCount: number,
): "1" | "2" | "3" | "5" | "a" | "m" {
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

	if (eventId === "333bf") return "5";

	if (eventId === "666" || eventId === "777") return "m";

	if (eventId === "444bf" || eventId === "555bf") return "3";

	return "a";
}

function normalize(name: string): string {
	return name.trim().toLowerCase();
}

function getActivityCode(name: string, round: number): string {
	const normalized = normalize(name);

	const eventId = EVENT_NAME_TO_ID[normalized];
	if (eventId) {
		return `${eventId}-r${round}`;
	}

	const otherDef = OTHER_ACTIVITIES[normalized];
	if (otherDef) {
		return otherDef.activityCode;
	}

	throw new Error(
		`Unknown activity: "${name}". Must be a valid event or one of: Intro to competing, Awards, Registration Opens, Lunch`,
	);
}

function isEvent(name: string): boolean {
	return !!EVENT_NAME_TO_ID[normalize(name)];
}

type WcifAdvancementCondition =
	| { type: "ranking"; level: number }
	| { type: "percent"; level: number }
	| { type: "attemptResult"; level: number };

function buildAdvancementCondition(
	previousRoundSize: number,
	progressionValue: number | null,
): WcifAdvancementCondition | undefined {
	if (progressionValue === null || previousRoundSize <= 0) return undefined;

	const percentValue = (progressionValue / previousRoundSize) * 100;
	const isApprox75 = percentValue >= 72 && percentValue <= 78;

	if (isApprox75) {
		return { type: "percent", level: 75 };
	}
	return { type: "ranking", level: Math.round(progressionValue) };
}

describe("Schedule Activity Name Mapping", () => {
	describe("Event Names", () => {
		it("should map exact event names", () => {
			expect(getActivityCode("3x3", 1)).toBe("333-r1");
			expect(getActivityCode("2x2", 2)).toBe("222-r2");
			expect(getActivityCode("Pyraminx", 1)).toBe("pyram-r1");
		});

		it("should be case-insensitive", () => {
			expect(getActivityCode("3X3", 1)).toBe("333-r1");
			expect(getActivityCode("CLOCK", 1)).toBe("clock-r1");
			expect(getActivityCode("Square-1", 1)).toBe("sq1-r1");
			expect(getActivityCode("3x3 One-Handed", 1)).toBe("333oh-r1");
		});
	});

	describe("Other Activities", () => {
		it("should identify events vs other activities correctly", () => {
			expect(isEvent("Registration Opens")).toBe(false);
			expect(isEvent("Lunch (Sat)")).toBe(false);
			expect(isEvent("Awards")).toBe(false);
			expect(isEvent("3x3")).toBe(true);
		});

		it("should map Registration Opens to checkin code", () => {
			expect(getActivityCode("Registration Opens", 1)).toBe("other-checkin");
		});

		it("should map Lunch variants to lunch code", () => {
			expect(getActivityCode("Lunch", 1)).toBe("other-lunch");
			expect(getActivityCode("Lunch (Sat)", 1)).toBe("other-lunch");
			expect(getActivityCode("Lunch (Sun)", 1)).toBe("other-lunch");
			expect(getActivityCode("LUNCH (SAT)", 1)).toBe("other-lunch");
		});

		it("should map Awards to awards code", () => {
			expect(getActivityCode("Awards", 1)).toBe("other-awards");
		});

		it("should map Intro to Competing to tutorial code", () => {
			expect(getActivityCode("Intro to competing", 1)).toBe("other-tutorial");
		});

		it("should throw error for unknown activities", () => {
			expect(() => getActivityCode("Custom Activity", 1)).toThrow(
				'Unknown activity: "Custom Activity"',
			);
			expect(() => getActivityCode("Breakfast", 1)).toThrow(
				'Unknown activity: "Breakfast"',
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
			expect(getRoundFormat("333bf", 1)).toBe("5");
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
			{ input: "Registration Opens", round: 1, expected: "other-checkin" },
			{ input: "Intro to competing", round: 1, expected: "other-tutorial" },
			{ input: "Lunch (Sat)", round: 1, expected: "other-lunch" },
			{ input: "Lunch (Sun)", round: 1, expected: "other-lunch" },
			{ input: "Awards", round: 1, expected: "other-awards" },
		];

		testCases.forEach(({ input, round, expected }) => {
			it(`should map "${input}" round ${round} to "${expected}"`, () => {
				expect(getActivityCode(input, round)).toBe(expected);
			});
		});
	});
});

describe("Advancement Condition Builder", () => {
	describe("75% Percent Threshold", () => {
		it("should return 75% percent when progression is approximately 75%", () => {
			expect(buildAdvancementCondition(100, 75)).toEqual({
				type: "percent",
				level: 75,
			});
			expect(buildAdvancementCondition(100, 72)).toEqual({
				type: "percent",
				level: 75,
			});
			expect(buildAdvancementCondition(100, 78)).toEqual({
				type: "percent",
				level: 75,
			});
			expect(buildAdvancementCondition(125, 93)).toEqual({
				type: "percent",
				level: 75,
			});
		});

		it("should not return percent for values outside 72-78% range", () => {
			expect(buildAdvancementCondition(100, 71)).toEqual({
				type: "ranking",
				level: 71,
			});
			expect(buildAdvancementCondition(100, 79)).toEqual({
				type: "ranking",
				level: 79,
			});
		});
	});

	describe("Ranking (Top N)", () => {
		it("should return ranking for non-75% values", () => {
			expect(buildAdvancementCondition(100, 50)).toEqual({
				type: "ranking",
				level: 50,
			});
			expect(buildAdvancementCondition(116, 72)).toEqual({
				type: "ranking",
				level: 72,
			});
			expect(buildAdvancementCondition(84, 48)).toEqual({
				type: "ranking",
				level: 48,
			});
		});

		it("should round non-integer progression values", () => {
			expect(buildAdvancementCondition(100, 50.6)).toEqual({
				type: "ranking",
				level: 51,
			});
			expect(buildAdvancementCondition(100, 50.4)).toEqual({
				type: "ranking",
				level: 50,
			});
		});
	});

	describe("Edge Cases", () => {
		it("should return undefined for null progression value", () => {
			expect(buildAdvancementCondition(100, null)).toBeUndefined();
		});

		it("should return undefined for zero or negative previous round size", () => {
			expect(buildAdvancementCondition(0, 50)).toBeUndefined();
			expect(buildAdvancementCondition(-10, 50)).toBeUndefined();
		});

		it("should handle sample data from sheet", () => {
			expect(buildAdvancementCondition(125, 93)).toEqual({
				type: "percent",
				level: 75,
			});
			expect(buildAdvancementCondition(93, 48)).toEqual({
				type: "ranking",
				level: 48,
			});
			expect(buildAdvancementCondition(48, 24)).toEqual({
				type: "ranking",
				level: 24,
			});
			expect(buildAdvancementCondition(116, 72)).toEqual({
				type: "ranking",
				level: 72,
			});
			expect(buildAdvancementCondition(72, 24)).toEqual({
				type: "ranking",
				level: 24,
			});
		});
	});
});
