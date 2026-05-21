import type { AuthConfig } from "convex/server";

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL;
if (!CONVEX_SITE_URL) {
	throw new Error("CONVEX_SITE_URL is not set");
}

export default {
	providers: [
		{
			domain: CONVEX_SITE_URL,
			applicationID: "convex",
		},
	],
} satisfies AuthConfig;
