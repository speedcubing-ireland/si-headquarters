import { v } from "convex/values"
import { internalMutation } from "@/convex/_generated/server"
import {
  loadAppSetting,
  normalizeMailbox,
  normalizeRecipients,
  normalizeSiteUrl,
  saveAppSetting,
} from "@/convex/settings/model"
import type { AppSettingKey } from "@/convex/settings/validators"

/**
 * The env vars these settings used to be. They are no longer declared in
 * `convex.config.ts`, so they are read from `process.env` directly.
 */
function legacyEnv(key: string): string | undefined {
  const value = process.env[key]?.trim()
  return value === undefined || value === "" ? undefined : value
}

/**
 * One-off: copies the settings that used to be env vars into `appSettings`,
 * for groups that have no row yet, so a deployment keeps behaving the same
 * after the upgrade. Run once per deployment, then unset the old env vars:
 *
 *   bunx convex run settings/migrations:importFromEnv
 *
 * Safe to re-run: it never overwrites a group a director already saved.
 */
export const importFromEnv = internalMutation({
  args: {},
  returns: v.object({
    imported: v.array(v.string()),
    skipped: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const imported: AppSettingKey[] = []
    const skipped: AppSettingKey[] = []
    const updatedAt = Date.now()

    async function importGroup(
      key: AppSettingKey,
      write: () => Promise<boolean>
    ): Promise<void> {
      if ((await loadAppSetting(ctx, key)) !== null || !(await write())) {
        skipped.push(key)
      } else {
        imported.push(key)
      }
    }

    await importGroup("canva", async () => {
      const pair = (template: string, folder: string) => {
        const brandTemplateId = legacyEnv(template)
        const outputFolderId = legacyEnv(folder)
        return brandTemplateId === undefined || outputFolderId === undefined
          ? undefined
          : { brandTemplateId, outputFolderId }
      }
      const certificates = pair(
        "CANVA_CERT_TEMPLATE_ID",
        "CANVA_CERT_OUTPUT_FOLDER_ID"
      )
      const lanyards = pair(
        "CANVA_LANYARD_TEMPLATE_ID",
        "CANVA_LANYARD_OUTPUT_FOLDER_ID"
      )
      if (certificates === undefined && lanyards === undefined) return false
      await saveAppSetting(ctx, {
        key: "canva",
        ...(certificates === undefined ? {} : { certificates }),
        ...(lanyards === undefined ? {} : { lanyards }),
        updatedAt,
      })
      return true
    })

    await importGroup("recordsEmail", async () => {
      const recipients = legacyEnv("SOCIAL_MEDIA_RECORDS_EMAIL_TO")
      const sender = legacyEnv("SOCIAL_MEDIA_EMAIL_SENDER_ADDRESS")
      if (recipients === undefined || sender === undefined) return false
      await saveAppSetting(ctx, {
        key: "recordsEmail",
        recipients: normalizeRecipients([recipients]),
        senderAddress: normalizeMailbox(
          sender,
          "SOCIAL_MEDIA_EMAIL_SENDER_ADDRESS"
        ),
        updatedAt,
      })
      return true
    })

    await importGroup("sponsorshipEmail", async () => {
      const sender = legacyEnv("SPONSORSHIP_EMAIL_SENDER_ADDRESS")
      if (sender === undefined) return false
      await saveAppSetting(ctx, {
        key: "sponsorshipEmail",
        senderAddress: normalizeMailbox(
          sender,
          "SPONSORSHIP_EMAIL_SENDER_ADDRESS"
        ),
        updatedAt,
      })
      return true
    })

    await importGroup("achievements", async () => {
      const siteUrl = legacyEnv("ACHIEVEMENTS_SITE_URL")
      if (siteUrl === undefined) return false
      await saveAppSetting(ctx, {
        key: "achievements",
        siteUrl: normalizeSiteUrl(siteUrl, "ACHIEVEMENTS_SITE_URL"),
        updatedAt,
      })
      return true
    })

    return { imported, skipped }
  },
})
