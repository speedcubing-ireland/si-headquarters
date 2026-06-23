import { z } from "zod"

export const FEATURE_IDS = [
  "google",
  "canva",
  "discord",
  "sponsors",
  "socialMedia",
  "wcaIntegration",
  "organiserInvites",
] as const

export type FeatureId = (typeof FEATURE_IDS)[number]

const nonEmptyString = z.string().trim().min(1)

const featureSchemaShape = {
  google: z.boolean(),
  canva: z.boolean(),
  discord: z.boolean(),
  sponsors: z.boolean(),
  socialMedia: z.boolean(),
  wcaIntegration: z.boolean(),
  organiserInvites: z.boolean(),
} satisfies Record<FeatureId, z.ZodBoolean>

const featureSchema = z.object(featureSchemaShape).strict()

export type FeatureConfig = z.infer<typeof featureSchema>

export const checkinSheetsEnabled = (features: FeatureConfig) =>
  features.google && features.wcaIntegration

export const sponsorshipEnabled = (features: FeatureConfig) => features.sponsors

// This provider must have the hostedDomain, this is what gates users when logging in not any of our own checks
// (i.e. any user with their company email can make an account)
const googleProviderSchema = z
  .object({
    id: z.literal("google"),
    audience: z.literal("staff"),
    label: nonEmptyString,
    hostedDomain: nonEmptyString,
  })
  .strict()

// This provider requires users to be already existing in the database (via the invite system)
const wcaProviderSchema = z
  .object({
    id: z.literal("wca"),
    audience: z.literal("organiser"),
    label: nonEmptyString,
  })
  .strict()

// This provider requires users to be already existing in the database (via manual addition)
const wcaStaffProviderSchema = z
  .object({
    id: z.literal("wca-staff"),
    audience: z.literal("staff"),
    label: nonEmptyString,
  })
  .strict()

export const loginProviderSchema = z.discriminatedUnion("id", [
  googleProviderSchema,
  wcaStaffProviderSchema,
  wcaProviderSchema,
])

export type LoginProviderConfig = z.infer<typeof loginProviderSchema>

const sponsorshipSchema = z
  .object({
    portalName: nonEmptyString,
    productionHost: nonEmptyString,
    defaultCurrency: nonEmptyString,
  })
  .strict()

const wcaSchema = z
  .object({
    scheduleTemplateCompetitionId: nonEmptyString,
  })
  .strict()

function requireConfig(
  ctx: z.RefinementCtx,
  value: string | object | undefined | null,
  path: (string | number)[],
  message: string
): void {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value === "")
  ) {
    ctx.addIssue({
      code: "custom",
      message,
      path,
    })
  }
}

export const organisationConfigSchema = z
  .object({
    organisation: z
      .object({
        name: nonEmptyString,
        productName: nonEmptyString,
      })
      .strict(),

    branding: z
      .object({
        notificationFooterText: nonEmptyString,
        faviconPath: z.string().trim().startsWith("/"),
      })
      .strict(),

    regional: z
      .object({
        locale: nonEmptyString,
        timeZone: nonEmptyString,
        timeZoneLabel: nonEmptyString,
        reminderHour: z.number().int().min(0).max(23),
      })
      .strict(),

    contacts: z
      .object({
        checkinShareEmail: z.email().optional(),
        sponsorshipTeamEmail: z.email().optional(),
        sponsorshipTeamName: nonEmptyString.optional(),
      })
      .strict(),

    sponsorship: sponsorshipSchema.optional(),

    wca: wcaSchema.optional(),

    features: featureSchema,

    auth: z
      .object({
        providers: z.array(loginProviderSchema),
      })
      .strict(),
  })
  .strict()
  .superRefine((config, ctx) => {
    const providerIds = new Set<string>()

    for (const [index, provider] of config.auth.providers.entries()) {
      if (providerIds.has(provider.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate login provider: ${provider.id}`,
          path: ["auth", "providers", index, "id"],
        })
      }

      providerIds.add(provider.id)
    }

    if (
      !config.auth.providers.some((provider) => provider.audience === "staff")
    ) {
      ctx.addIssue({
        code: "custom",
        message: "At least one staff login provider is required.",
        path: ["auth", "providers"],
      })
    }

    if (config.features.organiserInvites && !providerIds.has("wca")) {
      ctx.addIssue({
        code: "custom",
        message: "Organiser invites require the WCA login provider.",
        path: ["features", "organiserInvites"],
      })
    }

    if (config.features.organiserInvites && !config.features.wcaIntegration) {
      ctx.addIssue({
        code: "custom",
        message: "Organiser invites require WCA integration.",
        path: ["features", "organiserInvites"],
      })
    }

    if (checkinSheetsEnabled(config.features)) {
      requireConfig(
        ctx,
        config.contacts.checkinShareEmail,
        ["contacts", "checkinShareEmail"],
        "Check-in sheets require a check-in share email."
      )

      requireConfig(
        ctx,
        config.wca,
        ["wca"],
        "Check-in sheets require WCA configuration."
      )

      requireConfig(
        ctx,
        config.wca?.scheduleTemplateCompetitionId,
        ["wca", "scheduleTemplateCompetitionId"],
        "Check-in sheets require a WCA schedule template competition ID."
      )
    }

    if (sponsorshipEnabled(config.features)) {
      requireConfig(
        ctx,
        config.contacts.sponsorshipTeamEmail,
        ["contacts", "sponsorshipTeamEmail"],
        "Sponsor features require a sponsorship team email."
      )

      requireConfig(
        ctx,
        config.contacts.sponsorshipTeamName,
        ["contacts", "sponsorshipTeamName"],
        "Sponsor features require a sponsorship team name."
      )

      requireConfig(
        ctx,
        config.sponsorship,
        ["sponsorship"],
        "Sponsor features require sponsorship configuration."
      )
    }
  })

export type OrganisationConfig = z.infer<typeof organisationConfigSchema>

type ReadonlyDeep<T> = T extends (...args: never[]) => infer Return
  ? (...args: never[]) => Return
  : T extends readonly (infer Value)[]
    ? readonly ReadonlyDeep<Value>[]
    : T extends object
      ? { readonly [Key in keyof T]: ReadonlyDeep<T[Key]> }
      : T

export type OrganisationConfigDefinition = ReadonlyDeep<OrganisationConfig>

export interface SponsorshipConfigRequirements {
  contacts: { sponsorshipTeamEmail: string; sponsorshipTeamName: string }
  sponsorship: NonNullable<OrganisationConfig["sponsorship"]>
}

export interface CheckinSheetsConfigRequirements {
  contacts: { checkinShareEmail: string }
  wca: NonNullable<OrganisationConfig["wca"]>
}

// `object` is the intersection identity for a config (Config & object = Config),
// so disabled features add no requirements. The constraint only fires for
// literal-`true` flags, i.e. real `as const` manifests.
type FeatureConfigRequirements<F extends FeatureConfig> =
  (F["sponsors"] extends true ? SponsorshipConfigRequirements : object) &
    (F["google"] extends true
      ? F["wcaIntegration"] extends true
        ? CheckinSheetsConfigRequirements
        : object
      : object)

export function defineOrganisationConfig<
  const Config extends OrganisationConfigDefinition,
>(config: Config & FeatureConfigRequirements<Config["features"]>): Config {
  organisationConfigSchema.parse(config)
  return config
}
