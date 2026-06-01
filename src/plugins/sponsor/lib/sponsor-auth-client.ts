import { crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

const configuredBaseUrl = import.meta.env.VITE_CONVEX_SITE_URL;
const baseURL =
	typeof configuredBaseUrl === "string" ? configuredBaseUrl : undefined;

if (baseURL === undefined || baseURL.length === 0) {
	throw new Error("Missing VITE_CONVEX_SITE_URL for sponsor auth client.");
}

export const sponsorAuthClient = createAuthClient({
	baseURL,
	basePath: "/api/sponsor-auth",
	plugins: [
		emailOTPClient(),
		crossDomainClient({ storagePrefix: "sponsor-auth" }),
	],
});
