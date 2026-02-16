import { convexTest } from "convex-test";
import { afterEach, describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { TEAM_NAMES } from "./lib/constants";
import schema from "./schema";
import { modules } from "./test.setup";

const WCA_2FA_SECRET_ENV = "WCA_2FA_SECRET";

// 32-character Base32 secret (WCA format; ≥16 bytes for otplib default guardrails)
const VALID_32CHAR_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

function getConvexErrorMessage(error: unknown): string {
	if (
		typeof error === "object" &&
		error !== null &&
		"data" in error &&
		typeof error.data === "string"
	) {
		try {
			const parsed = JSON.parse(error.data) as { message?: unknown };
			if (typeof parsed.message === "string") {
				return parsed.message;
			}
		} catch {
			return error.data;
		}
	}
	if (
		typeof error === "object" &&
		error !== null &&
		"data" in error &&
		typeof error.data === "object" &&
		error.data !== null &&
		"message" in error.data &&
		typeof error.data.message === "string"
	) {
		return error.data.message;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

function getConvexErrorCode(error: unknown): string | null {
	if (
		typeof error === "object" &&
		error !== null &&
		"data" in error &&
		typeof error.data === "string"
	) {
		try {
			const parsed = JSON.parse(error.data) as { code?: unknown };
			return typeof parsed.code === "string" ? parsed.code : null;
		} catch {
			return null;
		}
	}
	if (
		typeof error === "object" &&
		error !== null &&
		"data" in error &&
		typeof error.data === "object" &&
		error.data !== null &&
		"code" in error.data &&
		typeof error.data.code === "string"
	) {
		return error.data.code;
	}
	return null;
}

async function seedAuthorizedUserWithTeam(teamName: string): Promise<{
	testHarness: ReturnType<typeof convexTest>;
	userId: string;
}> {
	const testHarness = convexTest(schema, modules);
	const userId = await testHarness.run(async (ctx) => {
		const insertedUserId = await ctx.db.insert("users", {
			email: `${teamName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
		});
		await ctx.db.insert("teams", {
			name: teamName,
			memberIds: [insertedUserId],
		});
		return insertedUserId;
	});
	return { testHarness, userId };
}

describe("wca2fa security", () => {
	const originalSecret = process.env[WCA_2FA_SECRET_ENV];

	afterEach(() => {
		if (originalSecret === undefined) {
			delete process.env[WCA_2FA_SECRET_ENV];
			return;
		}
		process.env[WCA_2FA_SECRET_ENV] = originalSecret;
	});

	test("returns 6-digit code and 60s period; payload never includes secret", async () => {
		process.env[WCA_2FA_SECRET_ENV] = VALID_32CHAR_SECRET;
		const { testHarness, userId } = await seedAuthorizedUserWithTeam(
			TEAM_NAMES.COMPETITIONS,
		);
		const authed = testHarness.withIdentity({ subject: userId });

		const result = await authed.action(api.wca2fa.generateCode, {});
		const serializedResult = JSON.stringify(result);

		expect(result.code).toMatch(/^\d{6}$/);
		expect(result.periodSeconds).toBe(60);
		expect(result.digits).toBe(6);
		expect(serializedResult).not.toContain(VALID_32CHAR_SECRET);
		expect(Object.keys(result).sort()).toEqual(
			[
				"code",
				"digits",
				"expiresAtMs",
				"generatedAtMs",
				"periodSeconds",
				"serverNowMs",
			].sort(),
		);
	});

	test("error responses do not echo invalid secret values", async () => {
		const invalidSecret = "INVALID*SECRET";
		process.env[WCA_2FA_SECRET_ENV] = invalidSecret;
		const { testHarness, userId } = await seedAuthorizedUserWithTeam(
			TEAM_NAMES.COMPETITIONS,
		);
		const authed = testHarness.withIdentity({ subject: userId });

		let capturedError: unknown = null;
		try {
			await authed.action(api.wca2fa.generateCode, {});
		} catch (error) {
			capturedError = error;
		}

		expect(capturedError).toBeTruthy();
		expect(getConvexErrorCode(capturedError)).toBe("PRECONDITION_FAILED");
		expect(getConvexErrorMessage(capturedError)).not.toContain(invalidSecret);
	});
});
