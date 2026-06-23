"use node"

import { internal } from "@/convex/_generated/api"
import { internalAction } from "@/convex/_generated/server"
import {
  type NotificationAttachmentRequest,
  notificationEvent,
  type ResolvedNotificationDraft,
} from "@/convex/notifications/validators"
import {
  DISCORD_CUSTOM_ID_LIMIT,
  encodeNotificationAction,
} from "@/convex/notifications/actionCodec"
import { resolveDeploymentContext } from "@/convex/deploymentContext"
import { requireConvexEnv } from "@/convex/envTypes"
import {
  notificationFooterText,
  notificationIconUrl,
} from "@/convex/notifications/branding"

const DISCORD_API = "https://discord.com/api/v10"
const DISCORD_EMBED_FOOTER = {
  text: notificationFooterText(),
  icon_url: notificationIconUrl(),
} as const
const DISCORD_MAX_ACTION_ROWS = 5
const DISCORD_MAX_BUTTONS_PER_ROW = 5

function discordBotToken(): string {
  return requireConvexEnv(
    "DISCORD_BOT_TOKEN",
    "Discord notification dispatch requires DISCORD_BOT_TOKEN to be set."
  )
}

function discordActionSecret(): string {
  return requireConvexEnv(
    "DISCORD_ACTION_SECRET",
    "Discord notification dispatch requires DISCORD_ACTION_SECRET to be set."
  )
}

async function createDmChannel(discordUserId: string): Promise<string> {
  const response = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${discordBotToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: discordUserId }),
  })
  if (!response.ok) {
    throw new Error(
      `Discord DM channel creation failed (${String(response.status)}).`
    )
  }
  // eslint-disable-next-line typescript/consistent-type-assertions, typescript/no-unsafe-assignment
  const body = (await response.json()) as { id?: string }
  if (body.id === undefined) {
    throw new Error("Discord DM channel response did not include an id.")
  }
  return body.id
}

async function fetchAttachment(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.blob()
  } catch (error) {
    console.warn("Could not fetch notification attachment", error)
    return null
  }
}

async function toDiscordPayload(
  draft: ResolvedNotificationDraft,
  attachedFilenames: ReadonlySet<string>
) {
  const secret = discordActionSecret()
  const deploymentContext = resolveDeploymentContext()
  const sentAt = new Date().toISOString()
  const embeds = draft.embeds.map((embed) => ({
    title: embed.title,
    description: embed.description,
    url: embed.url,
    color: embed.color,
    fields: embed.fields,
    author:
      embed.author !== undefined
        ? {
            name: embed.author.name,
            icon_url: embed.author.iconUrl,
          }
        : undefined,
    footer:
      embed.footer !== undefined
        ? {
            text: embed.footer.text,
            icon_url: embed.footer.iconUrl,
          }
        : DISCORD_EMBED_FOOTER,
    timestamp: embed.timestamp ?? sentAt,
    image:
      embed.imageAttachment !== undefined &&
      attachedFilenames.has(embed.imageAttachment)
        ? { url: `attachment://${embed.imageAttachment}` }
        : undefined,
  }))

  const groupedButtons = new Map<number, typeof draft.buttons>()
  for (const button of draft.buttons) {
    const row = Math.max(0, Math.floor(button.row ?? 0))
    groupedButtons.set(row, [...(groupedButtons.get(row) ?? []), button])
  }
  const components = await Promise.all(
    [...groupedButtons]
      .sort(([left], [right]) => left - right)
      .slice(0, DISCORD_MAX_ACTION_ROWS)
      .map(async ([, buttons]) => ({
        type: 1,
        components: await Promise.all(
          buttons.slice(0, DISCORD_MAX_BUTTONS_PER_ROW).map(async (button) => {
            if (button.kind === "url") {
              return {
                type: 2,
                style: 5,
                label: button.label,
                url: button.url,
              }
            }
            const customId = await encodeNotificationAction(
              button.action,
              secret,
              deploymentContext
            )
            if (customId.length > DISCORD_CUSTOM_ID_LIMIT) {
              throw new Error(
                "Discord notification action payload is too long."
              )
            }
            return {
              type: 2,
              style: button.action.kind === "claimTask" ? 3 : 1,
              label: button.label,
              custom_id: customId,
            }
          })
        ),
      }))
  )

  return {
    embeds,
    components,
    allowed_mentions: { parse: [] },
  }
}

interface AttachmentFetchResult {
  index: number
  attachment: NotificationAttachmentRequest
  blob: Blob | null
}

async function sendDiscordMessage(
  channelId: string,
  draft: ResolvedNotificationDraft
) {
  const attachments = draft.attachments ?? []
  const fetchedAttachments: AttachmentFetchResult[] = await Promise.all(
    attachments.map(async (attachment, index) => ({
      index,
      attachment,
      blob: await fetchAttachment(attachment.url),
    }))
  )
  const attachedFiles = fetchedAttachments.filter(
    (entry): entry is AttachmentFetchResult & { blob: Blob } =>
      entry.blob !== null
  )
  const attachedFilenames = new Set(
    attachedFiles.map((entry) => entry.attachment.filename)
  )
  const payload = await toDiscordPayload(draft, attachedFilenames)

  let body: BodyInit
  let headers: HeadersInit = {
    Authorization: `Bot ${discordBotToken()}`,
  }

  if (attachedFiles.length === 0) {
    body = JSON.stringify(payload)
    headers = { ...headers, "Content-Type": "application/json" }
  } else {
    const form = new FormData()
    form.append("payload_json", JSON.stringify(payload))
    for (const file of attachedFiles) {
      form.append(
        `files[${String(file.index)}]`,
        file.blob,
        file.attachment.filename
      )
    }
    body = form
  }

  const response = await fetch(
    `${DISCORD_API}/channels/${channelId}/messages`,
    {
      method: "POST",
      headers,
      body,
    }
  )
  if (!response.ok) {
    throw new Error(`Discord message send failed (${String(response.status)}).`)
  }
}

async function sendDraft(draft: ResolvedNotificationDraft) {
  const channelId =
    draft.target.kind === "discordChannel"
      ? draft.target.channelId
      : await createDmChannel(draft.target.discordUserId)
  await sendDiscordMessage(channelId, draft)
}

function formatDispatchError(error: Error): string {
  return error.message
}

export const dispatchEvent = internalAction({
  args: { event: notificationEvent },
  handler: async (ctx, args) => {
    const drafts = await ctx.runQuery(
      internal.notifications.model.resolveEventDrafts,
      { event: args.event }
    )
    let reminderSendError: string | null = null
    let reminderSendSucceeded = false

    for (const draft of drafts) {
      try {
        await sendDraft(draft)
        if (args.event.kind === "taskReminder") {
          reminderSendSucceeded = true
        }
      } catch (error) {
        console.warn("Notification Discord send failed", error)
        if (args.event.kind === "taskReminder") {
          reminderSendError = formatDispatchError(
            error instanceof Error ? error : new Error("Discord send failed.")
          )
        }
      }
    }

    if (args.event.kind === "taskReminder") {
      const errorMessage =
        reminderSendError ??
        (drafts.length === 0
          ? "No linked Discord account to deliver this reminder."
          : reminderSendSucceeded
            ? null
            : "Discord send failed.")
      await ctx.runMutation(
        internal.notifications.reminders.recordDispatchOutcome,
        {
          reminderId: args.event.reminderId,
          success: reminderSendSucceeded,
          errorMessage,
        }
      )
    }
    return null
  },
})
