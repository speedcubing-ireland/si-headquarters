import { v } from "convex/values"
import {
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "@/convex/_generated/server"
import { requireDirector } from "@/convex/permissions/principal"
import { defaultSponsorshipSenderAddress } from "@/convex/plugins/sponsor/emails/sender"
import {
  canvaPresetSettingsFor,
  clearAppSetting,
  loadAppSetting,
  normalizeCanvaPreset,
  normalizeMailbox,
  normalizeRecipients,
  normalizeSiteUrl,
  saveAppSetting,
} from "@/convex/settings/model"
import {
  CANVA_SETTINGS_PRESET_KEYS,
  canvaPresetSettings,
  canvaSettingsPresetKey,
  type CanvaPresetSettings,
  type CanvaSettingsPresetKey,
} from "@/convex/settings/validators"

const updatedAt = v.union(v.number(), v.null())
const nullableCanvaPreset = v.union(canvaPresetSettings, v.null())

/** Everything Admin → Settings shows, with nulls for what isn't configured. */
export const get = query({
  args: {},
  returns: v.object({
    canva: v.object({
      certificates: nullableCanvaPreset,
      lanyards: nullableCanvaPreset,
      updatedAt,
    }),
    recordsEmail: v.object({
      recipients: v.array(v.string()),
      senderAddress: v.union(v.string(), v.null()),
      updatedAt,
    }),
    sponsorshipEmail: v.object({
      senderAddress: v.union(v.string(), v.null()),
      defaultSenderAddress: v.union(v.string(), v.null()),
      updatedAt,
    }),
    achievements: v.object({
      siteUrl: v.union(v.string(), v.null()),
      updatedAt,
    }),
  }),
  handler: async (ctx) => {
    await requireDirector(ctx)
    const [canva, recordsEmail, sponsorshipEmail, achievements] =
      await Promise.all([
        loadAppSetting(ctx, "canva"),
        loadAppSetting(ctx, "recordsEmail"),
        loadAppSetting(ctx, "sponsorshipEmail"),
        loadAppSetting(ctx, "achievements"),
      ])
    return {
      canva: {
        certificates: canva?.certificates ?? null,
        lanyards: canva?.lanyards ?? null,
        updatedAt: canva?.updatedAt ?? null,
      },
      recordsEmail: {
        recipients: recordsEmail?.recipients ?? [],
        senderAddress: recordsEmail?.senderAddress ?? null,
        updatedAt: recordsEmail?.updatedAt ?? null,
      },
      sponsorshipEmail: {
        senderAddress: sponsorshipEmail?.senderAddress ?? null,
        defaultSenderAddress: defaultSponsorshipSenderAddress(),
        updatedAt: sponsorshipEmail?.updatedAt ?? null,
      },
      achievements: {
        siteUrl: achievements?.siteUrl ?? null,
        updatedAt: achievements?.updatedAt ?? null,
      },
    }
  },
})

async function audit(ctx: MutationCtx) {
  return { updatedById: await requireDirector(ctx), updatedAt: Date.now() }
}

const PRESET_LABELS: Record<CanvaSettingsPresetKey, string> = {
  certificates: "Certificates",
  lanyards: "Lanyards",
}

export const updateCanva = mutation({
  args: {
    certificates: nullableCanvaPreset,
    lanyards: nullableCanvaPreset,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auditFields = await audit(ctx)
    const presets: Partial<
      Record<CanvaSettingsPresetKey, CanvaPresetSettings>
    > = {}
    for (const key of CANVA_SETTINGS_PRESET_KEYS) {
      const value = args[key]
      if (value !== null) {
        presets[key] = normalizeCanvaPreset(value, PRESET_LABELS[key])
      }
    }
    if (presets.certificates === undefined && presets.lanyards === undefined) {
      await clearAppSetting(ctx, "canva")
      return null
    }
    await saveAppSetting(ctx, { key: "canva", ...presets, ...auditFields })
    return null
  },
})

export const updateRecordsEmail = mutation({
  args: {
    recipients: v.array(v.string()),
    senderAddress: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auditFields = await audit(ctx)
    await saveAppSetting(ctx, {
      key: "recordsEmail",
      recipients: normalizeRecipients(args.recipients),
      senderAddress: normalizeMailbox(args.senderAddress, "Sender address"),
      ...auditFields,
    })
    return null
  },
})

/** `null` drops the override so the manifest's sponsorship address applies. */
export const updateSponsorshipEmail = mutation({
  args: { senderAddress: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auditFields = await audit(ctx)
    if (args.senderAddress === null || args.senderAddress.trim() === "") {
      await clearAppSetting(ctx, "sponsorshipEmail")
      return null
    }
    await saveAppSetting(ctx, {
      key: "sponsorshipEmail",
      senderAddress: normalizeMailbox(args.senderAddress, "Sender address"),
      ...auditFields,
    })
    return null
  },
})

/** `null` removes the site, which hides the badges link on tasks. */
export const updateAchievements = mutation({
  args: { siteUrl: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auditFields = await audit(ctx)
    if (args.siteUrl === null || args.siteUrl.trim() === "") {
      await clearAppSetting(ctx, "achievements")
      return null
    }
    await saveAppSetting(ctx, {
      key: "achievements",
      siteUrl: normalizeSiteUrl(args.siteUrl, "SI Achievements site"),
      ...auditFields,
    })
    return null
  },
})

/** For the Canva runner, which runs in a node action without `ctx.db`. */
export const getCanvaPresetSettings = internalQuery({
  args: { presetKey: canvaSettingsPresetKey },
  returns: nullableCanvaPreset,
  handler: async (ctx, args) => canvaPresetSettingsFor(ctx, args.presetKey),
})
