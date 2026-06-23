import { CANVA_DEFINITION } from "@/convex/plugins/canva/definition"
import { DISCORD_DEFINITION } from "@/convex/plugins/discord/definition"
import { GOOGLE_DEFINITION } from "@/convex/plugins/google/definition"
import { WCA_DEFINITION } from "@/convex/plugins/wca/definition"
import {
  configuredSponsorshipSenderAddress,
  organisationConfig,
} from "@/config/lib/organisation"
import type { OrganisationConfig } from "@/config/lib/organisation-schema"

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

export const AUTH_ENV_SETUP = [
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

export const MAIN_URL_ENV_SETUP = [
  {
    key: "SITE_URL",
    group: "URLs",
    kind: "prompt",
    description: `${organisationConfig.organisation.productName} frontend origin.`,
    defaultValue: "http://localhost:5173",
  },
] as const satisfies readonly EnvSetupSpec[]

export const SPONSOR_URL_ENV_SETUP = [
  {
    key: "SPONSOR_SITE_URL",
    group: "URLs",
    kind: "prompt",
    description: "Sponsor portal frontend origin.",
    defaultValue: "http://localhost:5174",
  },
] as const satisfies readonly EnvSetupSpec[]

const GOOGLE_AUTH_ENV_SETUP = [
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
] as const satisfies readonly EnvSetupSpec[]

const WCA_AUTH_ENV_SETUP = [
  {
    key: "AUTH_WCA_ID",
    group: "WCA",
    kind: "prompt",
    description:
      "WCA OAuth client ID for organiser login (separate app from SERVICE_WCA_ID).",
  },
  {
    key: "AUTH_WCA_SECRET",
    group: "WCA",
    kind: "prompt",
    description: "WCA OAuth client secret for organiser login.",
    sensitive: true,
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
    defaultValue: configuredSponsorshipSenderAddress(),
  },
] as const satisfies readonly EnvSetupSpec[]

function uniqueByKey(specs: readonly EnvSetupSpec[]): EnvSetupSpec[] {
  const seen = new Set<string>()
  return specs.filter((spec) => {
    if (seen.has(spec.key)) return false
    seen.add(spec.key)
    return true
  })
}

export const ALL_ENV_SETUP = uniqueByKey([
  ...AUTH_ENV_SETUP,
  ...APP_SECRET_ENV_SETUP,
  ...MAIN_URL_ENV_SETUP,
  ...SPONSOR_URL_ENV_SETUP,
  ...GOOGLE_AUTH_ENV_SETUP,
  ...WCA_AUTH_ENV_SETUP,
  ...GOOGLE_DEFINITION.setup,
  ...WCA_DEFINITION.setup,
  ...CANVA_DEFINITION.setup,
  ...DISCORD_DEFINITION.setup,
  ...EMAIL_ENV_SETUP,
])

export function buildRequiredEnvSetup(
  config: OrganisationConfig
): EnvSetupSpec[] {
  const providerIds = new Set(
    config.auth.providers.map((provider) => provider.id)
  )
  return [
    ...AUTH_ENV_SETUP,
    ...APP_SECRET_ENV_SETUP.filter(
      (spec) =>
        spec.key !== "SPONSOR_BETTER_AUTH_SECRET" || config.features.sponsors
    ),
    ...MAIN_URL_ENV_SETUP,
    ...(config.features.sponsors ? SPONSOR_URL_ENV_SETUP : []),
    ...(providerIds.has("google") ? GOOGLE_AUTH_ENV_SETUP : []),
    ...(providerIds.has("wca") || providerIds.has("wca-staff")
      ? WCA_AUTH_ENV_SETUP
      : []),
    ...(config.features.google ? GOOGLE_DEFINITION.setup : []),
    ...(config.features.wcaIntegration ? WCA_DEFINITION.setup : []),
    ...(config.features.canva ? CANVA_DEFINITION.setup : []),
    ...(config.features.discord ? DISCORD_DEFINITION.setup : []),
    ...(config.features.sponsors ? EMAIL_ENV_SETUP : []),
  ]
}

export const REQUIRED_ENV_SETUP = buildRequiredEnvSetup(organisationConfig)

export const REQUIRED_ENV_KEYS = unique(
  REQUIRED_ENV_SETUP.filter((spec: EnvSetupSpec) => spec.optional !== true).map(
    (spec) => spec.key
  )
)

export const ALL_ENV_KEYS = unique(ALL_ENV_SETUP.map((spec) => spec.key))

export const OPTIONAL_ENV_KEYS = ALL_ENV_KEYS.filter(
  (key) => !REQUIRED_ENV_KEYS.includes(key)
)
