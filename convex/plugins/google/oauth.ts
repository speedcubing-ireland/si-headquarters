import { defineOAuthPlugin, type OAuthPluginMeta } from "../oauthProvider"
import { GOOGLE_OAUTH_ENV } from "@/convex/plugins/google/definition"

const SCOPE = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
].join(" ")

export const meta = {
  id: "google",
  service: "google",
  cli: {
    providerDisplayName: "Google",
    providerArg: "google",
    port: 3847,
    redirectHost: "localhost",
    successHeading: "Google account linked",
    missingAuthUrlMessage:
      "Could not get OAuth URL. Check SERVICE_GOOGLE_ID in Convex env.",
    usePkce: true,
    useState: true,
  },
} as const satisfies OAuthPluginMeta

export const plugin = defineOAuthPlugin({
  meta,
  pkce: true,
  client: {
    displayName: "Google",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: SCOPE,
    clientIdEnv: GOOGLE_OAUTH_ENV.clientId,
    clientSecretEnv: GOOGLE_OAUTH_ENV.clientSecret,
    defaultExpiresInSec: 3600,
    authStyle: "body",
  },
})
