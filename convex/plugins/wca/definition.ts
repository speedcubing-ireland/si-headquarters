import type { EnvServiceManifest, EnvServiceOAuth } from "@/convex/envConfig"

const WCA_OAUTH_ENV_KEYS_LITERAL = [
  "SERVICE_WCA_ID",
  "SERVICE_WCA_SECRET",
] as const

export const WCA_OAUTH_ENV = {
  clientId: "SERVICE_WCA_ID",
  clientSecret: "SERVICE_WCA_SECRET",
} as const satisfies EnvServiceOAuth<typeof WCA_OAUTH_ENV_KEYS_LITERAL>

export const WCA_2FA_SECRET_ENV = "WCA_2FA_SECRET" as const

export const WCA_2FA_DEFINITION = {
  env: [WCA_2FA_SECRET_ENV] as const,
  setup: [
    {
      key: WCA_2FA_SECRET_ENV,
      group: "WCA",
      kind: "prompt",
      description: "Base32 WCA two-factor secret.",
      sensitive: true,
    },
  ],
} as const satisfies EnvServiceManifest

export const WCA_DEFINITION = {
  env: WCA_OAUTH_ENV_KEYS_LITERAL,
  oauth: WCA_OAUTH_ENV,
  setup: [
    {
      key: "SERVICE_WCA_ID",
      group: "Service OAuth",
      kind: "prompt",
      description: "WCA OAuth client ID.",
    },
    {
      key: "SERVICE_WCA_SECRET",
      group: "Service OAuth",
      kind: "prompt",
      description: "WCA OAuth client secret.",
      sensitive: true,
    },
  ],
} as const satisfies EnvServiceManifest

export const WCA_ENV_KEYS = WCA_DEFINITION.env

export const wcaPlugin = {
  id: "wca",
  service: "wca",
  env: WCA_ENV_KEYS,
} as const
