import { defineOAuthPlugin, type OAuthPluginMeta } from "../oauthProvider"
import { resolveWcaBaseUrl } from "@/convex/deploymentContext"

export const oauthCredentialEnv = {
  clientId: "SERVICE_WCA_ID",
  clientSecret: "SERVICE_WCA_SECRET",
} as const

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
    authorizationUrl: () => `${resolveWcaBaseUrl()}/oauth/authorize`,
    tokenUrl: () => `${resolveWcaBaseUrl()}/oauth/token`,
    scope: "public email manage_competitions",
    clientIdEnv: oauthCredentialEnv.clientId,
    clientSecretEnv: oauthCredentialEnv.clientSecret,
    defaultExpiresInSec: 7200,
    authStyle: "body",
    expiryFromCreatedAt: true,
  },
})
