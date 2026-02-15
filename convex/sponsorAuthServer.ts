import { createClient } from "@convex-dev/better-auth";
import { crossDomain } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import { passkey } from "@better-auth/passkey";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { enqueueDispatch } from "./emailQueue/enqueue";
import schema from "./sponsorAuth/schema";

const SPONSOR_AUTH_BASE_PATH = "/api/sponsor-auth";
const SPONSOR_OTP_EXPIRES_SECONDS = 10 * 60;
const SPONSOR_AUTH_DEV_SECRET =
	"dev-only-sponsor-auth-secret-change-in-production";
const DEFAULT_SPONSOR_SITE_URL =
	process.env.NODE_ENV === "production"
		? "https://hq.speedcubing.ie"
		: "http://localhost:5173";

function trimTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

function uniqueOrigins(values: (string | undefined)[]): string[] {
	const normalized = values
		.filter((value): value is string => typeof value === "string")
		.map((value) => trimTrailingSlash(value))
		.filter((value) => value.length > 0);
	return [...new Set(normalized)];
}

function sponsorPortalUrl(): string {
	const siteUrl = process.env.SITE_URL ?? "https://hq.speedcubing.ie";
	return new URL("/sponsor/login", siteUrl).toString();
}

function resolveSponsorSiteOrigin(): string {
	const siteUrl =
		process.env.SITE_URL ??
		process.env.NEXT_PUBLIC_SITE_URL ??
		DEFAULT_SPONSOR_SITE_URL;
	return new URL(siteUrl).origin;
}

function resolveSponsorAuthSecret(requireConfiguredSecret: boolean): string {
	const configured =
		process.env.SPONSOR_BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET;
	if (configured && configured.length >= 32) {
		return configured;
	}
	if (requireConfiguredSecret) {
		throw new Error(
			"Missing BETTER_AUTH_SECRET/SPONSOR_BETTER_AUTH_SECRET (min 32 chars).",
		);
	}
	return SPONSOR_AUTH_DEV_SECRET;
}

async function sendSponsorOtpEmail(
	ctx: GenericCtx<DataModel>,
	args: {
		email: string;
		otp: string;
		type: "sign-in" | "forget-password" | "email-verification";
	},
): Promise<void> {
	const purposeLabel =
		args.type === "sign-in"
			? "sign in"
			: args.type === "forget-password"
				? "reset your password"
				: "verify your email";
	const subject =
		args.type === "forget-password"
			? "Speedcubing Ireland Sponsor Portal password reset code"
			: "Speedcubing Ireland Sponsor Portal sign-in code";
	const portalUrl = sponsorPortalUrl();
	const plainText = [
		`Use this code to ${purposeLabel}:`,
		args.otp,
		"",
		`This code expires in ${Math.floor(SPONSOR_OTP_EXPIRES_SECONDS / 60)} minutes.`,
		`Sponsor portal: ${portalUrl}`,
	].join("\n");

	const html = [
		"<p>Use this code for the Speedcubing Ireland Sponsor Portal:</p>",
		`<p style="font-family:monospace;font-size:28px;letter-spacing:0.2em;"><strong>${args.otp}</strong></p>`,
		`<p>This code expires in ${Math.floor(SPONSOR_OTP_EXPIRES_SECONDS / 60)} minutes.</p>`,
		`<p><a href="${portalUrl}">Open sponsor portal</a></p>`,
	].join("");

	const dedupeKey = `sponsor_auth_otp:${args.type}:${args.email.toLowerCase()}:${args.otp}`;
	await enqueueDispatch(ctx as unknown as MutationCtx, {
		dedupeKey,
		sourceKind: "sponsor_auth",
		sourceRef: dedupeKey,
		templateKey: "sponsor_auth_otp",
		recipientEmail: args.email,
		subject,
		htmlBody: html,
		plainTextBody: plainText,
	});
}

export const sponsorAuthComponent = createClient<DataModel, typeof schema>(
	components.sponsorAuth,
	{
		local: { schema },
	},
);

export function createSponsorAuthOptions(
	ctx: GenericCtx<DataModel>,
	options?: { requireConfiguredSecret?: boolean },
): BetterAuthOptions {
	const baseUrl = process.env.CONVEX_SITE_URL ?? "http://localhost:3210";
	const sponsorSiteOrigin = resolveSponsorSiteOrigin();
	const passkeyRpId = new URL(sponsorSiteOrigin).hostname;
	const secret = resolveSponsorAuthSecret(
		options?.requireConfiguredSecret ?? false,
	);

	const trustedOrigins = uniqueOrigins([
		process.env.SITE_URL,
		process.env.NEXT_PUBLIC_SITE_URL,
		sponsorSiteOrigin,
		"http://localhost:5173",
		"http://localhost:3000",
		"https://hq.speedcubing.ie",
	]);

	return {
		appName: "Speedcubing Ireland Sponsor Portal",
		baseURL: trimTrailingSlash(baseUrl),
		basePath: SPONSOR_AUTH_BASE_PATH,
		secret,
		trustedOrigins,
		database: sponsorAuthComponent.adapter(ctx),
		user: {
			additionalFields: {
				userId: {
					type: "string",
					required: false,
					input: false,
				},
			},
		},
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 12,
		},
		session: {
			expiresIn: 30 * 24 * 60 * 60,
			updateAge: 12 * 60 * 60,
		},
		plugins: [
			crossDomain({
				siteUrl: sponsorSiteOrigin,
			}),
			emailOTP({
				disableSignUp: true,
				expiresIn: SPONSOR_OTP_EXPIRES_SECONDS,
				storeOTP: "hashed",
				allowedAttempts: 5,
				sendVerificationOTP: async ({ email, otp, type }) => {
					await sendSponsorOtpEmail(ctx, { email, otp, type });
				},
			}),
			passkey({
				rpID: passkeyRpId,
				rpName: "Speedcubing Ireland Sponsor Portal",
				origin: trustedOrigins,
			}),
		],
	};
}

export function createSponsorAuth(ctx: GenericCtx<DataModel>) {
	return betterAuth(
		createSponsorAuthOptions(ctx, {
			requireConfiguredSecret: true,
		}),
	);
}
