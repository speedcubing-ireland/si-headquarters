import { describe, expect, test } from "vitest";
import { NOTIFICATION_TYPES } from "../lib/validators";
import { discordNotificationRegistry } from "./registry";

describe("discordNotificationRegistry", () => {
	test("covers every notification type exactly once", () => {
		const expected = [...NOTIFICATION_TYPES].sort();
		const actual = Object.keys(discordNotificationRegistry).sort();

		expect(actual).toEqual(expected);
	});

	test("uses matching definition type values", () => {
		for (const [key, definition] of Object.entries(
			discordNotificationRegistry,
		)) {
			expect(definition.type).toBe(key);
		}
	});
});
