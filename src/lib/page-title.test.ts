import { describe, expect, it } from "vitest";
import { getPageTitle } from "./page-title";

const HQ = "Headquarters | Speedcubing Ireland";
const SP = "Sponsors | Speedcubing Ireland";

describe("getPageTitle", () => {
	it.each([
		["/", HQ],
		["/competitions", HQ],
		["/admin/foo", HQ],
		["/sponsors", HQ],
		["/sponsor", SP],
		["/sponsor/", SP],
		["/sponsor/login", SP],
		["/sponsor/auctions/123", SP],
		["/sponsor/settings", SP],
	])("%s → %s", (pathname, expected) => {
		expect(getPageTitle(pathname)).toBe(expected);
	});
});
