import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("sheetsQueries behavior characterization", () => {
	test("getGoogleSheetsConnectionStatus returns false when no token exists", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });

		const status = await authed.query(
			api.sheetsQueries.getGoogleSheetsConnectionStatus,
			{},
		);
		expect(status.connected).toBe(false);
	});

	test("getGoogleSheetsConnectionStatus returns true for non-expired token", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });
		const nowSec = Math.floor(Date.now() / 1000);

		await t.run((ctx) =>
			ctx.db.insert("googleSheetsTokens", {
				accessToken: "access",
				refreshToken: "refresh",
				expiresAt: nowSec + 3600,
				updatedAt: Date.now(),
			}),
		);

		const status = await authed.query(
			api.sheetsQueries.getGoogleSheetsConnectionStatus,
			{},
		);
		expect(status.connected).toBe(true);
	});

	test("getGoogleSheetsConnectionStatus returns true for expired token when refresh token exists", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });
		const nowSec = Math.floor(Date.now() / 1000);

		await t.run((ctx) =>
			ctx.db.insert("googleSheetsTokens", {
				accessToken: "access",
				refreshToken: "refresh",
				expiresAt: nowSec - 3600,
				updatedAt: Date.now(),
			}),
		);

		const status = await authed.query(
			api.sheetsQueries.getGoogleSheetsConnectionStatus,
			{},
		);
		expect(status.connected).toBe(true);
	});

	test("getGoogleSheetsConnectionStatus returns false when access token is expired and refresh token is blank", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });
		const nowSec = Math.floor(Date.now() / 1000);

		await t.run((ctx) =>
			ctx.db.insert("googleSheetsTokens", {
				accessToken: "access",
				refreshToken: "",
				expiresAt: nowSec - 3600,
				updatedAt: Date.now(),
			}),
		);

		const status = await authed.query(
			api.sheetsQueries.getGoogleSheetsConnectionStatus,
			{},
		);
		expect(status.connected).toBe(false);
	});

	test("getGoogleSheetsConnectionStatus ignores caller-provided nowSec", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });
		const nowSec = Math.floor(Date.now() / 1000);

		await t.run((ctx) =>
			ctx.db.insert("googleSheetsTokens", {
				accessToken: "access",
				refreshToken: "refresh",
				expiresAt: nowSec - 3600,
				updatedAt: Date.now(),
			}),
		);

		const status = await authed.query(
			api.sheetsQueries.getGoogleSheetsConnectionStatus,
			{ nowSec: 0 },
		);
		expect(status.connected).toBe(true);
	});
});
