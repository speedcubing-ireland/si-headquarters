import type { EnvServiceManifest, EnvServiceOAuth } from "@/convex/envConfig"

const CANVA_ENV_KEYS_LITERAL = [
  "SERVICE_CANVA_ID",
  "SERVICE_CANVA_SECRET",
  "CANVA_CERT_TEMPLATE_ID",
  "CANVA_CERT_OUTPUT_FOLDER_ID",
  "CANVA_LANYARD_TEMPLATE_ID",
  "CANVA_LANYARD_OUTPUT_FOLDER_ID",
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
    {
      key: "CANVA_CERT_TEMPLATE_ID",
      group: "Canva",
      kind: "prompt",
      description: "Canva certificate brand template ID.",
    },
    {
      key: "CANVA_CERT_OUTPUT_FOLDER_ID",
      group: "Canva",
      kind: "prompt",
      description: "Canva certificate output folder ID.",
    },
    {
      key: "CANVA_LANYARD_TEMPLATE_ID",
      group: "Canva",
      kind: "prompt",
      description: "Canva lanyard brand template ID.",
    },
    {
      key: "CANVA_LANYARD_OUTPUT_FOLDER_ID",
      group: "Canva",
      kind: "prompt",
      description: "Canva lanyard output folder ID.",
    },
  ],
} as const satisfies EnvServiceManifest

export const CANVA_ENV_KEYS = CANVA_DEFINITION.env

export const canvaPluginDefinition = {
  id: "canva",
  service: "canva",
  env: CANVA_ENV_KEYS,
} as const
