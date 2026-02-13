import { passkeyClient } from "@better-auth/passkey/client";
import { crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

const baseURL = import.meta.env.VITE_CONVEX_SITE_URL;

if (!baseURL) {
	throw new Error("Missing VITE_CONVEX_SITE_URL for sponsor auth client.");
}

export const sponsorAuthClient = createAuthClient({
	baseURL,
	basePath: "/api/sponsor-auth",
	plugins: [
		emailOTPClient(),
		passkeyClient(),
		crossDomainClient({ storagePrefix: "sponsor-auth" }),
	],
});
