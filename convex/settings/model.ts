import type { WithoutSystemFields } from "convex/server"
import { ConvexError } from "convex/values"
import type { Doc } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import type {
  AppSettingKey,
  CanvaPresetSettings,
  CanvaSettingsPresetKey,
} from "@/convex/settings/validators"

type AppSettingDoc = Doc<"appSettings">
export type AppSetting<K extends AppSettingKey> = Extract<
  AppSettingDoc,
  { key: K }
>

/** Where the error messages send people to fix a missing setting. */
export const SETTINGS_LOCATION = "Admin → Settings"

function isSetting<K extends AppSettingKey>(
  row: AppSettingDoc,
  key: K
): row is AppSetting<K> {
  return row.key === key
}

export async function loadAppSetting<K extends AppSettingKey>(
  ctx: QueryCtx,
  key: K
): Promise<AppSetting<K> | null> {
  const row = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique()
  return row !== null && isSetting(row, key) ? row : null
}

/** Writes the group's row whole, so cleared optional fields don't linger. */
export async function saveAppSetting(
  ctx: MutationCtx,
  fields: WithoutSystemFields<AppSettingDoc>
): Promise<void> {
  const existing = await loadAppSetting(ctx, fields.key)
  if (existing === null) {
    await ctx.db.insert("appSettings", fields)
  } else {
    await ctx.db.replace("appSettings", existing._id, fields)
  }
}

export async function clearAppSetting(
  ctx: MutationCtx,
  key: AppSettingKey
): Promise<void> {
  const existing = await loadAppSetting(ctx, key)
  if (existing !== null) {
    await ctx.db.delete("appSettings", existing._id)
  }
}

// ---------------------------------------------------------------------------
// Input normalisation. Each returns the value to store or throws a ConvexError
// the admin screen shows as-is.

function badRequest(message: string): never {
  throw new ConvexError({ code: "BAD_REQUEST", message })
}

const EMAIL_ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
// `Display Name <address@example.com>`, the form Resend accepts for `from`.
const NAMED_MAILBOX = /^([^<>]*\S)\s*<([^<>]+)>$/

/** A bare address, or `Name <address>`, trimmed. */
export function normalizeMailbox(value: string, label: string): string {
  const trimmed = value.trim()
  if (trimmed === "") badRequest(`${label} is required.`)
  const named = NAMED_MAILBOX.exec(trimmed)
  const address = named === null ? trimmed : named[2].trim()
  if (!EMAIL_ADDRESS.test(address)) {
    badRequest(
      `${label} must be an email address, optionally as "Name <address>".`
    )
  }
  return named === null ? address : `${named[1].trim()} <${address}>`
}

/** Comma- or newline-separated addresses, deduplicated, at least one. */
export function normalizeRecipients(values: readonly string[]): string[] {
  const addresses = values
    .flatMap((value) => value.split(/[,\n]/))
    .map((address) => address.trim())
    .filter((address) => address.length > 0)
  if (addresses.length === 0) badRequest("Add at least one recipient.")
  for (const address of addresses) {
    if (!EMAIL_ADDRESS.test(address)) {
      badRequest(`"${address}" is not an email address.`)
    }
  }
  return [...new Set(addresses)]
}

/** An absolute http(s) URL, without trailing slashes. */
export function normalizeSiteUrl(value: string, label: string): string {
  const trimmed = value.trim()
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    badRequest(`${label} must be an absolute URL, e.g. https://example.com.`)
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    badRequest(`${label} must start with https:// or http://.`)
  }
  return trimmed.replace(/\/+$/, "")
}

export function normalizeCanvaPreset(
  value: CanvaPresetSettings,
  label: string
): CanvaPresetSettings {
  const brandTemplateId = value.brandTemplateId.trim()
  const outputFolderId = value.outputFolderId.trim()
  if (brandTemplateId === "" || outputFolderId === "") {
    badRequest(
      `${label} needs both a brand template ID and an output folder ID.`
    )
  }
  return { brandTemplateId, outputFolderId }
}

// ---------------------------------------------------------------------------
// Readers for the code that used to read env.

export async function canvaPresetSettingsFor(
  ctx: QueryCtx,
  presetKey: CanvaSettingsPresetKey
): Promise<CanvaPresetSettings | null> {
  const row = await loadAppSetting(ctx, "canva")
  return row?.[presetKey] ?? null
}

export async function requireRecordsEmailSettings(ctx: QueryCtx): Promise<{
  recipients: string[]
  senderAddress: string
}> {
  const row = await loadAppSetting(ctx, "recordsEmail")
  if (row === null || row.recipients.length === 0) {
    throw new Error(
      `The weekly records email has no recipients or sender. Configure it in ${SETTINGS_LOCATION}.`
    )
  }
  return { recipients: row.recipients, senderAddress: row.senderAddress }
}

export async function sponsorshipSenderOverride(
  ctx: QueryCtx
): Promise<string | null> {
  const row = await loadAppSetting(ctx, "sponsorshipEmail")
  return row?.senderAddress ?? null
}

export async function achievementsSiteUrl(
  ctx: QueryCtx
): Promise<string | null> {
  const row = await loadAppSetting(ctx, "achievements")
  return row?.siteUrl ?? null
}
