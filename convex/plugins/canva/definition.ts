import type { EnvServiceManifest, EnvServiceOAuth } from "@/convex/envConfig"

// Brand template and output folder IDs are not here: they are operational
// settings directors edit in Admin → Settings (`convex/settings`).
const CANVA_ENV_KEYS_LITERAL = [
  "SERVICE_CANVA_ID",
  "SERVICE_CANVA_SECRET",
] as const

export const CANVA_OAUTH_ENV = {
  clientId: "SERVICE_CANVA_ID",
  clientSecret: "SERVICE_CANVA_SECRET",
} as const satisfies EnvServiceOAuth<typeof CANVA_ENV_KEYS_LITERAL>

export const CANVA_DEFINITION = {
  env: CANVA_ENV_KEYS_LITERAL,
  oauth: CANVA_OAUTH_ENV,
  setup: [
    {
      key: "SERVICE_CANVA_ID",
      group: "Service OAuth",
      kind: "prompt",
      description: "Canva OAuth client ID.",
    },
    {
      key: "SERVICE_CANVA_SECRET",
      group: "Service OAuth",
      kind: "prompt",
      description: "Canva OAuth client secret.",
      sensitive: true,
    },
  ],
} as const satisfies EnvServiceManifest

export const CANVA_ENV_KEYS = CANVA_DEFINITION.env

export const canvaPluginDefinition = {
  id: "canva",
  service: "canva",
  env: CANVA_ENV_KEYS,
} as const
