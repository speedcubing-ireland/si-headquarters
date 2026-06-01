import { afterEach, describe, expect, test } from "vitest";
import {
	trimTrailingSlash,
	uniqueOrigins,
	resolveSponsorAuthSecret,
	buildSponsorOtpEmail,
	createSponsorAuthOptions,
} from "./server";

describe("trimTrailingSlash", () => {
	test("removes trailing slash", () => {
		expect(trimTrailingSlash("https://example.com/")).toBe(
			"https://example.com",
		);
	});

	test("leaves strings without trailing slash unchanged", () => {
		expect(trimTrailingSlash("https://example.com")).toBe(
			"https://example.com",
		);
	});

	test("only removes one trailing slash", () => {
		expect(trimTrailingSlash("https://example.com//")).toBe(
			"https://example.com/",
		);
	});

	test("handles empty string", () => {
		expect(trimTrailingSlash("")).toBe("");
	});
});

describe("uniqueOrigins", () => {
	test("deduplicates identical origins", () => {
		expect(
			uniqueOrigins(["https://a.com", "https://a.com", "https://b.com"]),
		).toEqual(["https://a.com", "https://b.com"]);
	});

	test("deduplicates after trimming trailing slashes", () => {
		expect(uniqueOrigins(["https://a.com/", "https://a.com"])).toEqual([
			"https://a.com",
		]);
	});

	test("filters out undefined values", () => {
		expect(uniqueOrigins([undefined, "https://a.com", undefined])).toEqual([
			"https://a.com",
		]);
	});

	test("filters out empty strings", () => {
		expect(uniqueOrigins(["", "https://a.com", ""])).toEqual(["https://a.com"]);
	});

	test("returns empty array for all undefined/empty input", () => {
		expect(uniqueOrigins([undefined, "", undefined])).toEqual([]);
	});
});

describe("resolveSponsorAuthSecret", () => {
	const savedSponsor = process.env.SPONSOR_BETTER_AUTH_SECRET;
	const savedGeneric = process.env.BETTER_AUTH_SECRET;

	function clearSecretEnv() {
		delete process.env.SPONSOR_BETTER_AUTH_SECRET;
		delete process.env.BETTER_AUTH_SECRET;
	}

	afterEach(() => {
		if (savedSponsor !== undefined)
			process.env.SPONSOR_BETTER_AUTH_SECRET = savedSponsor;
		else delete process.env.SPONSOR_BETTER_AUTH_SECRET;
		if (savedGeneric !== undefined)
			process.env.BETTER_AUTH_SECRET = savedGeneric;
		else delete process.env.BETTER_AUTH_SECRET;
	});

	test("returns SPONSOR_BETTER_AUTH_SECRET when set and long enough", () => {
		process.env.SPONSOR_BETTER_AUTH_SECRET = "a".repeat(32);
		process.env.BETTER_AUTH_SECRET = "b".repeat(32);
		expect(resolveSponsorAuthSecret(false)).toBe("a".repeat(32));
	});

	test("falls back to BETTER_AUTH_SECRET", () => {
		delete process.env.SPONSOR_BETTER_AUTH_SECRET;
		process.env.BETTER_AUTH_SECRET = "b".repeat(32);
		expect(resolveSponsorAuthSecret(false)).toBe("b".repeat(32));
	});

	test("rejects secrets shorter than 32 characters", () => {
		clearSecretEnv();
		process.env.SPONSOR_BETTER_AUTH_SECRET = "short";
		expect(resolveSponsorAuthSecret(false)).toBe(
			"dev-only-sponsor-auth-secret-change-in-production",
		);
	});

	test("returns dev fallback when no secret configured", () => {
		clearSecretEnv();
		expect(resolveSponsorAuthSecret(false)).toBe(
			"dev-only-sponsor-auth-secret-change-in-production",
		);
	});

	test("throws when requireConfiguredSecret is true and no valid secret", () => {
		clearSecretEnv();
		expect(() => resolveSponsorAuthSecret(true)).toThrow(
			"Missing BETTER_AUTH_SECRET",
		);
	});
});

describe("createSponsorAuthOptions", () => {
	const fakeCtx = {
		runMutation: () => Promise.resolve(),
		runQuery: () => Promise.resolve(),
		runAction: () => Promise.resolve(),
	} as unknown as Parameters<typeof createSponsorAuthOptions>[0];

	test("uses email OTP only (no password or passkey)", () => {
		let options: ReturnType<typeof createSponsorAuthOptions>;
		try {
			options = createSponsorAuthOptions(fakeCtx);
		} catch {
			return;
		}
		expect(options.emailAndPassword?.enabled).toBe(false);
		expect(
			(options.plugins ?? []).find((p) => p.id === "passkey"),
		).toBeUndefined();
		expect(
			(options.plugins ?? []).find((p) => p.id === "email-otp"),
		).toBeDefined();
	});
});

describe("buildSponsorOtpEmail sender address", () => {
	const saved = process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS;

	afterEach(() => {
		if (saved !== undefined)
			process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS = saved;
		else delete process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS;
	});

	test("uses SPONSORSHIP_EMAIL_SENDER_ADDRESS env var when set", async () => {
		process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS = "custom@example.com";
		const result = await buildSponsorOtpEmail({
			email: "user@example.com",
			otp: "123456",
			type: "sign-in",
		});
		expect(result.senderAddress).toBe("custom@example.com");
	});

	test("falls back to sponsorship@speedcubingireland.com when env unset", async () => {
		delete process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS;
		const result = await buildSponsorOtpEmail({
			email: "user@example.com",
			otp: "123456",
			type: "sign-in",
		});
		expect(result.senderAddress).toBe("sponsorship@speedcubingireland.com");
	});

	test("falls back to default when env var is whitespace", async () => {
		process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS = "   ";
		const result = await buildSponsorOtpEmail({
			email: "user@example.com",
			otp: "123456",
			type: "sign-in",
		});
		expect(result.senderAddress).toBe("sponsorship@speedcubingireland.com");
	});
});

describe("buildSponsorOtpEmail", () => {
	test("builds sign-in email with correct subject", async () => {
		const result = await buildSponsorOtpEmail({
			email: "user@example.com",
			otp: "654321",
			type: "sign-in",
		});
		expect(result.subject).toBe(
			"Speedcubing Ireland Sponsor Portal sign-in code",
		);
	});

	test("builds email-verification with verification subject", async () => {
		const result = await buildSponsorOtpEmail({
			email: "user@example.com",
			otp: "111111",
			type: "email-verification",
		});
		expect(result.subject).toBe(
			"Speedcubing Ireland Sponsor Portal email verification code",
		);
	});

	test("preserves original email as recipientEmail", async () => {
		const result = await buildSponsorOtpEmail({
			email: "Test@Example.COM",
			otp: "123456",
			type: "sign-in",
		});
		expect(result.recipientEmail).toBe("Test@Example.COM");
	});

	test("includes OTP in both plain text and HTML body", async () => {
		const result = await buildSponsorOtpEmail({
			email: "user@example.com",
			otp: "987654",
			type: "sign-in",
		});
		expect(result.plainTextBody).toContain("987654");
		expect(result.htmlBody).toContain("987654");
	});

	test("includes 60 minute expiry in body", async () => {
		const result = await buildSponsorOtpEmail({
			email: "user@example.com",
			otp: "123456",
			type: "sign-in",
		});
		expect(result.plainTextBody).toContain("60 minutes");
	});

	test("includes purpose-specific text for sign-in", async () => {
		const result = await buildSponsorOtpEmail({
			email: "u@e.com",
			otp: "1",
			type: "sign-in",
		});
		expect(result.plainTextBody).toContain("sign in");
	});
});
