import { crossDomainClient } from "@convex-dev/better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import { emailOTPClient } from "better-auth/client/plugins"
import { env } from "@/env"

export const sponsorAuthClient = createAuthClient({
  baseURL: env.VITE_CONVEX_SITE_URL,
  basePath: "/api/sponsor-auth",
  plugins: [
    emailOTPClient(),
    crossDomainClient({ storagePrefix: "sponsor-auth" }),
  ],
})
