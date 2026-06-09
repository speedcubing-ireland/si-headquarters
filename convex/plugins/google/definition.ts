import type { EnvServiceManifest, EnvServiceOAuth } from "@/convex/envConfig"

const GOOGLE_ENV_KEYS = ["SERVICE_GOOGLE_ID", "SERVICE_GOOGLE_SECRET"] as const

export const GOOGLE_OAUTH_ENV = {
  clientId: "SERVICE_GOOGLE_ID",
  clientSecret: "SERVICE_GOOGLE_SECRET",
} as const satisfies EnvServiceOAuth<typeof GOOGLE_ENV_KEYS>

export const GOOGLE_DEFINITION = {
  env: GOOGLE_ENV_KEYS,
  oauth: GOOGLE_OAUTH_ENV,
  setup: [
    {
      key: "SERVICE_GOOGLE_ID",
      group: "Service OAuth",
      kind: "prompt",
      description: "Google service OAuth client ID.",
    },
    {
      key: "SERVICE_GOOGLE_SECRET",
      group: "Service OAuth",
      kind: "prompt",
      description: "Google service OAuth client secret.",
      sensitive: true,
    },
  ],
} as const satisfies EnvServiceManifest
