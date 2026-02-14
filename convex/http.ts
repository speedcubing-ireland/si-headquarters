import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { createSponsorAuth, sponsorAuthComponent } from "./sponsorAuthServer";

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
			"http://localhost:5173",
			"http://localhost:3000",
			"https://hq.speedcubing.ie",
			"https://headquarters-demo-ui.vercel.app",
			normalizeOrigin(process.env.SITE_URL),
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

export default http;
