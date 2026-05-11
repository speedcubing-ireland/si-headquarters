import { describe, expect, it } from "vitest";
import { formatWinningBid } from "./competition-properties-sidebar";

describe("formatWinningBid", () => {
	it("formats whole euros", () =>
		expect(formatWinningBid(10000)).toBe("€100.00"));
	it("formats cents correctly", () =>
		expect(formatWinningBid(5050)).toBe("€50.50"));
	it("formats zero", () => expect(formatWinningBid(0)).toBe("€0.00"));
});
