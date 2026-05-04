import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

async function importFlags() {
	vi.resetModules();
	return import("./feature-flags");
}

describe("isSponsorshipEnabled", () => {
	beforeEach(() => vi.resetModules());
	afterEach(() => vi.unstubAllEnvs());

	test.each([
		"1",
		"true",
		"yes",
		"TRUE",
		"True",
	])("returns true for %s", async (value) => {
		vi.stubEnv("VITE_SPONSORSHIP_ENABLED", value);
		const { isSponsorshipEnabled } = await importFlags();
		expect(isSponsorshipEnabled).toBe(true);
	});

	test.each([
		"",
		"0",
		"false",
		undefined,
	])("returns false for %s", async (value) => {
		if (value === undefined) {
			vi.stubEnv("VITE_SPONSORSHIP_ENABLED", "");
		} else {
			vi.stubEnv("VITE_SPONSORSHIP_ENABLED", value);
		}
		const { isSponsorshipEnabled } = await importFlags();
		expect(isSponsorshipEnabled).toBe(false);
	});
});

describe("isSponsorPasswordAuthEnabled", () => {
	beforeEach(() => vi.resetModules());
	afterEach(() => vi.unstubAllEnvs());

	test.each([
		"1",
		"true",
		"yes",
		"TRUE",
		"True",
	])("returns true for %s", async (value) => {
		vi.stubEnv("VITE_SPONSOR_PASSWORD_AUTH_ENABLED", value);
		const { isSponsorPasswordAuthEnabled } = await importFlags();
		expect(isSponsorPasswordAuthEnabled).toBe(true);
	});

	test.each([
		"",
		"0",
		"false",
		undefined,
	])("returns false for %s", async (value) => {
		if (value === undefined) {
			vi.stubEnv("VITE_SPONSOR_PASSWORD_AUTH_ENABLED", "");
		} else {
			vi.stubEnv("VITE_SPONSOR_PASSWORD_AUTH_ENABLED", value);
		}
		const { isSponsorPasswordAuthEnabled } = await importFlags();
		expect(isSponsorPasswordAuthEnabled).toBe(false);
	});
});
