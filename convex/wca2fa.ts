"use node";

import { createHmac } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

const DEFAULT_PERIOD_SECONDS = 30;
const DEFAULT_DIGITS = 6;
const MIN_DIGITS = 6;
const MAX_DIGITS = 8;
const MIN_PERIOD_SECONDS = 15;
const MAX_PERIOD_SECONDS = 120;
const WCA_2FA_SECRET_ENV = "WCA_2FA_SECRET";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

type TotpConfig = {
	secret: string;
	periodSeconds: number;
	digits: number;
};

function parseTotpConfigFromEnv(raw: string | undefined): TotpConfig | null {
	if (!raw) return null;

	const trimmed = raw.trim();
	if (!trimmed) return null;

	let secret = trimmed;
	let periodSeconds = DEFAULT_PERIOD_SECONDS;
	let digits = DEFAULT_DIGITS;

	if (trimmed.toLowerCase().startsWith("otpauth://")) {
		try {
			const parsed = new URL(trimmed);
			const secretParam = parsed.searchParams.get("secret");
			if (secretParam) {
				secret = secretParam;
			}

			const periodParam = Number(parsed.searchParams.get("period"));
			if (
				Number.isInteger(periodParam) &&
				periodParam >= MIN_PERIOD_SECONDS &&
				periodParam <= MAX_PERIOD_SECONDS
			) {
				periodSeconds = periodParam;
			}

			const digitsParam = Number(parsed.searchParams.get("digits"));
			if (
				Number.isInteger(digitsParam) &&
				digitsParam >= MIN_DIGITS &&
				digitsParam <= MAX_DIGITS
			) {
				digits = digitsParam;
			}
		} catch {
			return null;
		}
	}

	const normalizedSecret = secret
		.toUpperCase()
		.replace(/[\s-]/g, "")
		.replace(/=+$/g, "");

	if (!normalizedSecret) return null;

	return {
		secret: normalizedSecret,
		periodSeconds,
		digits,
	};
}

function decodeBase32Secret(secret: string): Buffer {
	const bytes: number[] = [];
	let current = 0;
	let bits = 0;

	for (const char of secret) {
		const value = BASE32_ALPHABET.indexOf(char);
		if (value === -1) {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message: `${WCA_2FA_SECRET_ENV} must contain a valid Base32 secret.`,
			});
		}
		current = (current << 5) | value;
		bits += 5;
		if (bits >= 8) {
			bytes.push((current >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}

	if (bytes.length === 0) {
		throw new ConvexError({
			code: "PRECONDITION_FAILED",
			message: `${WCA_2FA_SECRET_ENV} must contain a valid Base32 secret.`,
		});
	}

	return Buffer.from(bytes);
}

function generateTotpCode(
	config: TotpConfig,
	nowMs: number,
): {
	code: string;
	expiresAtMs: number;
} {
	const counter = Math.floor(nowMs / (config.periodSeconds * 1000));
	const counterBuffer = Buffer.alloc(8);
	counterBuffer.writeBigUInt64BE(BigInt(counter));

	const key = decodeBase32Secret(config.secret);
	const digest = createHmac("sha1", key).update(counterBuffer).digest();
	const offset = digest[digest.length - 1] & 0x0f;
	const binary =
		((digest[offset] & 0x7f) << 24) |
		((digest[offset + 1] & 0xff) << 16) |
		((digest[offset + 2] & 0xff) << 8) |
		(digest[offset + 3] & 0xff);

	const code = (binary % 10 ** config.digits)
		.toString()
		.padStart(config.digits, "0");
	const expiresAtMs =
		(Math.floor(nowMs / (config.periodSeconds * 1000)) + 1) *
		config.periodSeconds *
		1000;

	return { code, expiresAtMs };
}

export const generateCode = action({
	args: {},
	returns: v.object({
		code: v.string(),
		digits: v.number(),
		periodSeconds: v.number(),
		generatedAtMs: v.number(),
		expiresAtMs: v.number(),
		serverNowMs: v.number(),
	}),
	handler: async (ctx) => {
		const canAccess = await ctx.runQuery(api.admin.canAccessWca2fa, {});
		if (!canAccess) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Directors and Competitions Team members only.",
			});
		}

		const config = parseTotpConfigFromEnv(process.env[WCA_2FA_SECRET_ENV]);
		if (!config) {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message: `${WCA_2FA_SECRET_ENV} is not configured.`,
			});
		}

		const nowMs = Date.now();
		const { code, expiresAtMs } = generateTotpCode(config, nowMs);

		return {
			code,
			digits: config.digits,
			periodSeconds: config.periodSeconds,
			generatedAtMs: nowMs,
			expiresAtMs,
			serverNowMs: nowMs,
		};
	},
});
