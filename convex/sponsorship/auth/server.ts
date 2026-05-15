import { createClient } from "@convex-dev/better-auth";
import { crossDomain } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import { passkey } from "@better-auth/passkey";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { components } from "../../_generated/api";
import { internal } from "../../_generated/api";
import type { DataModel } from "../../_generated/dataModel";
import { renderSponsorPortalOtpEmail } from "../emails/SponsorPortalOtpEmail";
import { getSponsorshipSenderAddress } from "../../lib/email";
import {
	resolveSponsorPortalOriginForAuth,
	sponsorPortalLoginUrl,
} from "../../lib/siteUrls";
import schema from "./component/sponsorAuth/schema";

const SPONSOR_AUTH_BASE_PATH = "/api/sponsor-auth";
const SPONSOR_OTP_EXPIRES_SECONDS = 60 * 60;
const SPONSOR_AUTH_DEV_SECRET =
	"dev-only-sponsor-auth-secret-change-in-production";
export function trimTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function uniqueOrigins(values: (string | undefined)[]): string[] {
	const normalized = values
		.filter((value): value is string => typeof value === "string")
		.map((value) => trimTrailingSlash(value))
		.filter((value) => value.length > 0);
	return [...new Set(normalized)];
}

function sponsorPortalUrl(): string {
	return sponsorPortalLoginUrl();
}

function resolveSponsorSiteOrigin(): string {
	return resolveSponsorPortalOriginForAuth();
}

export function resolveSponsorAuthSecret(
	requireConfiguredSecret: boolean,
): string {
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

export async function buildSponsorOtpEmail(args: {
	email: string;
	otp: string;
	type: "sign-in" | "forget-password" | "email-verification";
}) {
	const purposeLabel =
		args.type === "sign-in"
			? ("sign in" as const)
			: args.type === "forget-password"
				? ("reset your password" as const)
				: ("verify your email" as const);
	const subject =
		args.type === "forget-password"
			? "Speedcubing Ireland Sponsor Portal password reset code"
			: "Speedcubing Ireland Sponsor Portal sign-in code";
	const portalUrl = sponsorPortalUrl();
	const expiresInMinutes = Math.floor(SPONSOR_OTP_EXPIRES_SECONDS / 60);
	const { html: htmlBody, plainText: plainTextBody } =
		await renderSponsorPortalOtpEmail({
			otp: args.otp,
			purposeLabel,
			expiresInMinutes,
			portalUrl,
		});
	const dedupeKey = `sponsor_auth_otp:${args.type}:${args.email.toLowerCase()}:${args.otp}`;
	return {
		dedupeKey,
		sourceKind: "sponsor_auth" as const,
		sourceRef: dedupeKey,
		templateKey: "sponsor_auth_otp",
		recipientEmail: args.email,
		senderAddress: getSponsorshipSenderAddress(),
		subject,
		htmlBody,
		plainTextBody,
	};
}

export function isSponsorPasswordAuthEnabled(): boolean {
	const value = process.env.SPONSOR_PASSWORD_AUTH_ENABLED?.trim().toLowerCase();
	return value === "1" || value === "true" || value === "yes";
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
		process.env.SPONSOR_SITE_URL,
		process.env.SITE_URL,
		process.env.NEXT_PUBLIC_SITE_URL,
		sponsorSiteOrigin,
		"http://localhost:5173",
		"http://localhost:5174",
		"http://localhost:3000",
		"https://hq.speedcubing.ie",
	]);

	const passwordAuthEnabled = isSponsorPasswordAuthEnabled();

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
			enabled: passwordAuthEnabled,
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
					if (!("runMutation" in ctx)) {
						throw new Error(
							"sendVerificationOTP requires a mutation or action context",
						);
					}
					await ctx.runMutation(
						internal.emailQueue._enqueueDispatch,
						await buildSponsorOtpEmail({ email, otp, type }),
					);
				},
			}),
			...(passwordAuthEnabled
				? [
						passkey({
							rpID: passkeyRpId,
							rpName: "Speedcubing Ireland Sponsor Portal",
							origin: trustedOrigins,
						}),
					]
				: []),
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
