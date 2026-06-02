import { defineOAuthPlugin, type OAuthPluginMeta } from "../oauthProvider"

export const WCA_BASE_URL = "https://www.worldcubeassociation.org"

export const meta = {
  id: "wca",
  service: "wca",
  cli: {
    providerDisplayName: "WCA",
    providerArg: "wca",
    port: 3848,
    redirectHost: "localhost",
    successHeading: "WCA account linked",
    missingAuthUrlMessage:
      "Could not get OAuth URL. Check SERVICE_WCA_ID in Convex env.",
    useState: true,
  },
} as const satisfies OAuthPluginMeta

export const plugin = defineOAuthPlugin({
  meta,
  client: {
    displayName: "WCA",
    authorizationUrl: `${WCA_BASE_URL}/oauth/authorize`,
    tokenUrl: `${WCA_BASE_URL}/oauth/token`,
    scope: "public email manage_competitions",
    clientIdEnv: "SERVICE_WCA_ID",
    clientSecretEnv: "SERVICE_WCA_SECRET",
    defaultExpiresInSec: 7200,
    authStyle: "body",
    expiryFromCreatedAt: true,
  },
})
