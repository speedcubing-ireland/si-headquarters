import { defineTable } from "convex/server"
import { v, type Infer } from "convex/values"

/**
 * Operational settings directors edit from Admin → Settings. They used to be
 * Convex env vars, but none of them are secrets or deployment identity — they
 * are choices the organisation changes while running (which Canva template,
 * who gets the records email), so they live in the database instead.
 *
 * One row per group, discriminated by `key`. Secrets, OAuth clients, URLs that
 * identify the deployment, and module-load flags stay in Convex env.
 */
export const APP_SETTING_KEYS = [
  "canva",
  "recordsEmail",
  "sponsorshipEmail",
  "achievements",
] as const

export type AppSettingKey = (typeof APP_SETTING_KEYS)[number]

/** The Canva presets that have a template + output folder to configure. */
export const CANVA_SETTINGS_PRESET_KEYS = ["certificates", "lanyards"] as const
export type CanvaSettingsPresetKey = (typeof CANVA_SETTINGS_PRESET_KEYS)[number]
export const canvaSettingsPresetKey = v.union(
  v.literal("certificates"),
  v.literal("lanyards")
)

export const canvaPresetSettings = v.object({
  brandTemplateId: v.string(),
  outputFolderId: v.string(),
})
export type CanvaPresetSettings = Infer<typeof canvaPresetSettings>

const audit = {
  // Optional so rows imported from the old env vars, which no signed-in user
  // wrote, still validate.
  updatedById: v.optional(v.id("users")),
  updatedAt: v.number(),
}

export const canvaSettingsFields = {
  certificates: v.optional(canvaPresetSettings),
  lanyards: v.optional(canvaPresetSettings),
}

export const recordsEmailSettingsFields = {
  recipients: v.array(v.string()),
  senderAddress: v.string(),
}

export const sponsorshipEmailSettingsFields = {
  senderAddress: v.string(),
}

export const achievementsSettingsFields = {
  siteUrl: v.string(),
}

export const appSettingsTable = defineTable(
  v.union(
    v.object({ key: v.literal("canva"), ...canvaSettingsFields, ...audit }),
    v.object({
      key: v.literal("recordsEmail"),
      ...recordsEmailSettingsFields,
      ...audit,
    }),
    v.object({
      key: v.literal("sponsorshipEmail"),
      ...sponsorshipEmailSettingsFields,
      ...audit,
    }),
    v.object({
      key: v.literal("achievements"),
      ...achievementsSettingsFields,
      ...audit,
    })
  )
).index("by_key", ["key"])
