import { oauthCredentialEnv as canvaOAuthCredentialEnv } from "@/convex/plugins/canva/oauth"
import { oauthCredentialEnv as googleOAuthCredentialEnv } from "@/convex/plugins/google/oauth"
import { oauthCredentialEnv as wcaOAuthCredentialEnv } from "@/convex/plugins/wca/oauth"

const PLUGIN_OAUTH_CREDENTIAL_ENVS = [
  canvaOAuthCredentialEnv,
  googleOAuthCredentialEnv,
  wcaOAuthCredentialEnv,
] as const

export type OAuthCredentialEnvName =
  (typeof PLUGIN_OAUTH_CREDENTIAL_ENVS)[number][keyof (typeof PLUGIN_OAUTH_CREDENTIAL_ENVS)[number]]

export const OAUTH_ENV_KEYS = [
  ...new Set(
    PLUGIN_OAUTH_CREDENTIAL_ENVS.flatMap((keys) => [
      keys.clientId,
      keys.clientSecret,
    ])
  ),
] satisfies readonly OAuthCredentialEnvName[]
