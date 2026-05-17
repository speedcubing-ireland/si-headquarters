import { httpRouter } from "convex/server";
import { auth } from "./core/auth";
import {
	createSponsorAuth,
	sponsorAuthComponent,
} from "./sponsorship/auth/server";
import { handleAzureEmailEvents } from "./webhooks/azureEmailEvents";
import { handleDiscordInteractions } from "./webhooks/discordInteractions";

const http = httpRouter();

function normalizeOrigin(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (trimmed.length === 0) return undefined;
	try {
		return new URL(trimmed).origin;
	} catch {
		return undefined;
	}
}

function parseOriginList(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(",")
		.map((entry) => normalizeOrigin(entry))
		.filter((entry): entry is string => Boolean(entry));
}

const allowedOrigins = Array.from(
	new Set(
		[
			normalizeOrigin(process.env.SITE_URL),
			normalizeOrigin(process.env.SPONSOR_SITE_URL),
			normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL),
			...parseOriginList(process.env.CORS_ALLOWED_ORIGINS),
		].filter((origin): origin is string => Boolean(origin)),
	),
);

auth.addHttpRoutes(http);
sponsorAuthComponent.registerRoutes(http, createSponsorAuth, {
	cors: {
		allowedOrigins,
	},
});

http.route({
	path: "/webhooks/azure/email-events",
	method: "POST",
	handler: handleAzureEmailEvents,
});

http.route({
	path: "/webhooks/discord/interactions",
	method: "POST",
	handler: handleDiscordInteractions,
});

export default http;
