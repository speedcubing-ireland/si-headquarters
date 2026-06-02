import { OAUTH_PLUGINS } from "@/convex/plugins/oauthRegistry"

export const OAUTH_ENV_KEYS = Array.from(
  new Set(
    OAUTH_PLUGINS.flatMap((plugin) => [
      plugin.client.clientIdEnv,
      plugin.client.clientSecretEnv,
    ])
  )
)
