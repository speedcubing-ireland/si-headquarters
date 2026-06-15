import { CANVA_DEFINITION } from "@/convex/plugins/canva/definition"
import { DISCORD_DEFINITION } from "@/convex/plugins/discord/definition"
import { GOOGLE_DEFINITION } from "@/convex/plugins/google/definition"
import { WCA_DEFINITION } from "@/convex/plugins/wca/definition"

export type EnvSetupGroup =
  | "Staff auth"
  | "App secrets"
  | "Service OAuth"
  | "Canva"
  | "Discord"
  | "Email"
  | "URLs"
  | "WCA"

export type EnvSetupKind = "prompt" | "select" | "generated"

export interface EnvSetupSpec {
  key: string
  group: EnvSetupGroup
  kind: EnvSetupKind
  description: string
  sensitive?: boolean
  optional?: boolean
  defaultValue?: string
  choices?: readonly string[]
}

export interface EnvServiceManifest {
  env: readonly string[]
  oauth?: {
    clientId: string
    clientSecret: string
  }
  setup: readonly EnvSetupSpec[]
}

export interface EnvServiceOAuth<TEnv extends readonly string[]> {
  clientId: TEnv[number]
  clientSecret: TEnv[number]
}

function unique<const T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

export const STAFF_AUTH_ENV_SETUP = [
  {
    key: "AUTH_GOOGLE_ID",
    group: "Staff auth",
    kind: "prompt",
    description: "Google OAuth client ID for staff login.",
  },
  {
    key: "AUTH_GOOGLE_SECRET",
    group: "Staff auth",
    kind: "prompt",
    description: "Google OAuth client secret for staff login.",
    sensitive: true,
  },
  {
    key: "JWT_PRIVATE_KEY",
    group: "Staff auth",
    kind: "generated",
    description: "Convex Auth RS256 private key.",
    sensitive: true,
  },
  {
    key: "JWKS",
    group: "Staff auth",
    kind: "generated",
    description: "Convex Auth public JWKS.",
    sensitive: true,
  },
] as const satisfies readonly EnvSetupSpec[]

export const APP_SECRET_ENV_SETUP = [
  {
    key: "DEPLOYMENT_CONTEXT",
    group: "App secrets",
    kind: "select",
    description: "Controls WCA staging vs production endpoints.",
    defaultValue: "staging",
    choices: ["staging", "production"],
  },
  {
    key: "CLI_AUTH_TOKEN",
    group: "App secrets",
    kind: "generated",
    description: "Shared secret for local service OAuth token exchange.",
    sensitive: true,
  },
  {
    key: "SPONSOR_BETTER_AUTH_SECRET",
    group: "App secrets",
    kind: "generated",
    description: "Better Auth secret for sponsor portal sessions.",
    sensitive: true,
  },
] as const satisfies readonly EnvSetupSpec[]

export const URL_ENV_SETUP = [
  {
    key: "SITE_URL",
    group: "URLs",
    kind: "prompt",
    description: "HQ frontend origin.",
    defaultValue: "http://localhost:5173",
  },
  {
    key: "SPONSOR_SITE_URL",
    group: "URLs",
    kind: "prompt",
    description: "Sponsor portal frontend origin.",
    defaultValue: "http://localhost:5174",
  },
] as const satisfies readonly EnvSetupSpec[]

const ORGANISER_AUTH_ENV_SETUP = [
  {
    key: "AUTH_WCA_ID",
    group: "WCA",
    kind: "prompt",
    description:
      "WCA OAuth client ID for organiser login (separate app from SERVICE_WCA_ID).",
    optional: true,
  },
  {
    key: "AUTH_WCA_SECRET",
    group: "WCA",
    kind: "prompt",
    description: "WCA OAuth client secret for organiser login.",
    sensitive: true,
    optional: true,
  },
] as const satisfies readonly EnvSetupSpec[]

export const EMAIL_ENV_SETUP = [
  {
    key: "RESEND_API_KEY",
    group: "Email",
    kind: "prompt",
    description: "Resend API key for sponsor emails.",
    sensitive: true,
  },
  {
    key: "RESEND_TEST_MODE",
    group: "Email",
    kind: "select",
    description: "Use Resend test mode for local development.",
    defaultValue: "true",
    choices: ["true", "false"],
  },
  {
    key: "SPONSORSHIP_EMAIL_SENDER_ADDRESS",
    group: "Email",
    kind: "prompt",
    description: "From address for sponsorship emails.",
    defaultValue: "Sponsorship Test <sponsorship@speedcubingireland.com>",
  },
] as const satisfies readonly EnvSetupSpec[]

export const REQUIRED_ENV_SETUP = [
  ...STAFF_AUTH_ENV_SETUP,
  ...APP_SECRET_ENV_SETUP,
  ...URL_ENV_SETUP,
  ...GOOGLE_DEFINITION.setup,
  ...WCA_DEFINITION.setup,
  ...ORGANISER_AUTH_ENV_SETUP,
  ...CANVA_DEFINITION.setup,
  ...DISCORD_DEFINITION.setup,
  ...EMAIL_ENV_SETUP,
] as const satisfies readonly EnvSetupSpec[]

export const REQUIRED_ENV_KEYS = unique(
  REQUIRED_ENV_SETUP.filter((spec: EnvSetupSpec) => spec.optional !== true).map(
    (spec) => spec.key
  )
)
