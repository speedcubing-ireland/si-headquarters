import { createClient } from "@convex-dev/better-auth";
import { crossDomain } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { emailOTP, type EmailOTPOptions } from "better-auth/plugins";
import { components } from "@/convex/_generated/api";
import { internal } from "@/convex/_generated/api";
import type { DataModel } from "@/convex/_generated/dataModel";
import {
  sponsorOtpAuthEmailSubject,
  sponsorOtpPurposeFromAuthType,
} from "../emails/copy";
import { buildSponsorPortalOtpEmail } from "../emails/render";
import { getSponsorshipSenderAddress } from "@/convex/plugins/sponsor/emails/sender";
import {
	resolveSponsorPortalOriginForAuth,
	sponsorPortalLoginUrl,
} from "@/convex/plugins/sponsor/siteUrls";
import schema from "./component/sponsorAuth/schema";

const SPONSOR_AUTH_BASE_PATH = "/api/sponsor-auth";
const SPONSOR_OTP_EXPIRES_SECONDS = 60 * 60;
const SPONSOR_AUTH_DEV_SECRET =
	"dev-only-sponsor-auth-secret-change-in-production";

type SponsorOtpType = Parameters<
	EmailOTPOptions["sendVerificationOTP"]
>[0]["type"];
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
	if (configured !== undefined && configured.length >= 32) {
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
	type: SponsorOtpType;
}) {
	const portalUrl = sponsorPortalUrl();
	const expiresInMinutes = Math.floor(SPONSOR_OTP_EXPIRES_SECONDS / 60);
	const purposeLabel = sponsorOtpPurposeFromAuthType(args.type);
	const { html: htmlBody, plainText: plainTextBody } =
		await buildSponsorPortalOtpEmail({
			otp: args.otp,
			purposeLabel,
			expiresInMinutes,
			portalUrl,
		});
	return {
		recipientEmail: args.email,
		senderAddress: getSponsorshipSenderAddress(),
		subject: sponsorOtpAuthEmailSubject(args.type),
		htmlBody,
		plainTextBody,
	};
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
			enabled: false,
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
					const otpEmail = await buildSponsorOtpEmail({ email, otp, type });
					await ctx.runMutation(
						internal.plugins.sponsor.emails.send.deliverSponsorshipEmail,
						{
							from: otpEmail.senderAddress,
							to: otpEmail.recipientEmail,
							subject: otpEmail.subject,
							html: otpEmail.htmlBody,
							text: otpEmail.plainTextBody,
						},
					);
				},
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
