import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import schema from "../../schema";
import { modules } from "../../test.setup";

describe("canva token behavior characterization", () => {
	test("getConnectionStatus returns false when no token exists", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });

		const status = await authed.query(
			api.integrations.tokens.getConnectionStatus,
			{
				service: "canva",
			},
		);
		expect(status.connected).toBe(false);
	});

	test("setTokens and getToken round-trip values", async () => {
		const t = convexTest(schema, modules);
		const nowSec = Math.floor(Date.now() / 1000);

		await t.mutation(internal.integrations.tokens.setTokens, {
			service: "canva",
			accessToken: "access",
			refreshToken: "refresh",
			expiresAt: nowSec + 1800,
		});

		const token = await t.query(internal.integrations.tokens.getToken, {
			service: "canva",
		});
		expect(token).toEqual({
			accessToken: "access",
			refreshToken: "refresh",
			expiresAt: nowSec + 1800,
		});
	});

	test("getConnectionStatus returns true for expired access token when refresh token exists", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });
		const nowSec = Math.floor(Date.now() / 1000);

		await t.run((ctx) =>
			ctx.db.insert("serviceTokens", {
				service: "canva",
				accessToken: "access",
				refreshToken: "refresh",
				expiresAt: nowSec - 3600,
				updatedAt: Date.now(),
			}),
		);

		const status = await authed.query(
			api.integrations.tokens.getConnectionStatus,
			{
				service: "canva",
			},
		);
		expect(status.connected).toBe(true);
	});
});
