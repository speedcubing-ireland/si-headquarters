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

const featureSchema = z
  .object({
    google: z.boolean(),
    canva: z.boolean(),
    discord: z.boolean(),
    sponsors: z.boolean(),
    socialMedia: z.boolean(),
    wcaIntegration: z.boolean(),
    organiserInvites: z.boolean(),
  })
  .strict()

// This provider must have the hostedDomain, this is what gates users when logging in not any of our own checks
// (i.e. any user with their company email can make an account)
const googleProviderSchema = z
  .object({
    id: z.literal("google"),
    audience: z.literal("staff"),
    label: z.string().trim().min(1),
    hostedDomain: z.string().trim().min(1),
  })
  .strict()

// This provider requires users to be already existing in the database (via the invite system)
const wcaProviderSchema = z
  .object({
    id: z.literal("wca"),
    audience: z.literal("organiser"),
    label: z.string().trim().min(1),
  })
  .strict()

// This provider requires users to be already existing in the database (via manual addition)
const wcaStaffProviderSchema = z
  .object({
    id: z.literal("wca-staff"),
    audience: z.literal("staff"),
    label: z.string().trim().min(1),
  })
  .strict()

export const loginProviderSchema = z.discriminatedUnion("id", [
  googleProviderSchema,
  wcaStaffProviderSchema,
  wcaProviderSchema,
])

export type LoginProviderConfig = z.infer<typeof loginProviderSchema>

export const organisationConfigSchema = z
  .object({
    organisation: z
      .object({
        name: z.string().trim().min(1),
        productName: z.string().trim().min(1),
      })
      .strict(),
    branding: z
      .object({
        notificationFooterText: z.string().trim().min(1),
        faviconPath: z.string().trim().startsWith("/"),
      })
      .strict(),
    regional: z
      .object({
        locale: z.string().trim().min(1),
        timeZone: z.string().trim().min(1),
        timeZoneLabel: z.string().trim().min(1),
        reminderHour: z.number().int().min(0).max(23),
      })
      .strict(),
    contacts: z
      .object({
        checkinShareEmail: z.email(),
        sponsorshipTeamEmail: z.email(),
        sponsorshipTeamName: z.string().trim().min(1),
      })
      .strict(),
    sponsorship: z
      .object({
        portalName: z.string().trim().min(1),
        productionHost: z.string().trim().min(1),
        defaultCurrency: z.string().trim().min(1),
      })
      .strict(),
    wca: z
      .object({
        scheduleTemplateCompetitionId: z.string().trim().min(1),
      })
      .strict(),
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
  })

export type OrganisationConfig = z.infer<typeof organisationConfigSchema>

export function defineOrganisationConfig(
  config: OrganisationConfig
): OrganisationConfig {
  return organisationConfigSchema.parse(config)
}
