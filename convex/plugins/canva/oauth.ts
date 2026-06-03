import { defineOAuthPlugin, type OAuthPluginMeta } from "../oauthProvider"

export const oauthCredentialEnv = {
  clientId: "SERVICE_CANVA_ID",
  clientSecret: "SERVICE_CANVA_SECRET",
} as const

const SCOPE = [
  "design:content:write",
  "design:meta:read",
  "folder:read",
  "folder:write",
  "brandtemplate:meta:read",
  "brandtemplate:content:read",
].join(" ")

export const meta = {
  id: "canva",
  service: "canva",
  cli: {
    providerDisplayName: "Canva",
    providerArg: "canva",
    port: 3849,
    redirectHost: "127.0.0.1",
    successHeading: "Canva account linked",
    missingAuthUrlMessage:
      "Could not get OAuth URL. Check SERVICE_CANVA_ID in Convex env.",
    usePkce: true,
    useState: true,
  },
} as const satisfies OAuthPluginMeta

export const plugin = defineOAuthPlugin({
  meta,
  pkce: true,
  client: {
    displayName: "Canva",
    authorizationUrl: "https://www.canva.com/api/oauth/authorize",
    tokenUrl: "https://api.canva.com/rest/v1/oauth/token",
    scope: SCOPE,
    clientIdEnv: oauthCredentialEnv.clientId,
    clientSecretEnv: oauthCredentialEnv.clientSecret,
    defaultExpiresInSec: 14_400,
    authStyle: "basic",
  },
})
