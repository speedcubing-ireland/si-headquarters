import { describe, expect, test } from "vitest";
import { getPhaseKeyFromName } from "./competition-phase-config";

describe("competition phase config", () => {
	test("maps canonical phase names to keys", () => {
		expect(getPhaseKeyFromName("Concept")).toBe("concept");
		expect(getPhaseKeyFromName("Pre-Announcement")).toBe("pre-announcement");
		expect(getPhaseKeyFromName("Post-Announcement")).toBe("post-announcement");
		expect(getPhaseKeyFromName("Pre-Competition")).toBe("pre-competition");
		expect(getPhaseKeyFromName("Post-Competition")).toBe("post-competition");
		expect(getPhaseKeyFromName("Archive")).toBe("archive");
	});

	test("maps prefixed phase names", () => {
		expect(getPhaseKeyFromName("archive (legacy)")).toBe("archive");
		expect(getPhaseKeyFromName("pre-competition planning")).toBe(
			"pre-competition",
		);
	});

	test("falls back to concept for unknown or empty names", () => {
		expect(getPhaseKeyFromName("")).toBe("concept");
		expect(getPhaseKeyFromName("custom")).toBe("concept");
		expect(getPhaseKeyFromName(null)).toBe("concept");
		expect(getPhaseKeyFromName(undefined)).toBe("concept");
	});
});
