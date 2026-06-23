import type { Doc } from "@/convex/_generated/dataModel"
import type {
  NotificationDraft,
  NotificationEmbed,
  NotificationTarget,
} from "@/convex/notifications/validators"
import { resolveUserAvatarUrl } from "@/convex/users/avatar"
import {
  notificationFooterText,
  notificationIconUrl,
} from "@/convex/notifications/branding"

export const EMBED_COLOR = {
  normal: 0x2563eb,
  warning: 0xea580c,
  urgent: 0xdc2626,
  success: 0x16a34a,
  review: 0x7c3aed,
} as const

const SYSTEM_AUTHOR = {
  name: notificationFooterText(),
  iconUrl: notificationIconUrl(),
} as const

export function userDisplayName(
  user: Pick<Doc<"users">, "name" | "discordDisplayName" | "email"> | null,
  fallback = "Unknown user"
): string {
  if (user === null) return fallback
  return user.name ?? user.discordDisplayName ?? user.email ?? fallback
}

export function truncateDiscordPreview(
  value: string | undefined,
  maxLength = 220
): string {
  const trimmed = value?.trim()
  if (trimmed === undefined || trimmed.length === 0) return ""
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`
}

export function statusLabel(status: string): string {
  return status
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ")
}

function taskDescription(task: Pick<Doc<"tasks">, "name">): string {
  return `**${task.name}**`
}

function taskContextFields(
  task: Pick<Doc<"tasks">, "dueDate">
): NonNullable<NotificationEmbed["fields"]> {
  if (task.dueDate === null) return []
  return [embedField(":calendar_spiral:", "Due", task.dueDate, true)]
}

function embedAuthor(
  actor: Pick<
    Doc<"users">,
    | "name"
    | "image"
    | "discordUserId"
    | "discordAvatarHash"
    | "discordDisplayName"
    | "email"
  > | null
): NotificationEmbed["author"] {
  if (actor === null) return SYSTEM_AUTHOR
  const name = userDisplayName(actor)
  const iconUrl = resolveUserAvatarUrl(actor)
  return iconUrl !== undefined ? { name, iconUrl } : { name }
}

export function embedField(
  emoji: string,
  label: string,
  value: string,
  inline = false
): NonNullable<NotificationEmbed["fields"]>[number] {
  return {
    name: `${emoji} ${label}`,
    value,
    inline,
  }
}

export function isChannelTarget(target: NotificationTarget): boolean {
  return target.kind === "discordChannel"
}

function buildTaskEmbed(input: {
  task: Doc<"tasks">
  rootName: string | null
  actor: Doc<"users"> | null
  url: string
  title: string
  description?: string
  color?: number
  fields: NonNullable<NotificationEmbed["fields"]>
}): NotificationEmbed {
  return {
    title: input.title,
    description:
      input.description ??
      (input.rootName !== null
        ? `${taskDescription(input.task)}\n${input.rootName}`
        : taskDescription(input.task)),
    url: input.url,
    color: input.color ?? EMBED_COLOR.normal,
    fields: [...input.fields, ...taskContextFields(input.task)],
    author: embedAuthor(input.actor),
  }
}

function buildCompetitionEmbed(input: {
  competition: Doc<"competitions">
  actor: Doc<"users"> | null
  url: string
  title: string
  color?: number
  description?: string
  fields: NonNullable<NotificationEmbed["fields"]>
}): NotificationEmbed {
  return {
    title: input.title,
    description: input.description,
    url: input.url,
    color: input.color ?? EMBED_COLOR.normal,
    fields: input.fields,
    author: embedAuthor(input.actor),
  }
}

function buildProjectEmbed(input: {
  project: Doc<"projects">
  actor: Doc<"users"> | null
  url: string
  title: string
  color?: number
  description?: string
  fields: NonNullable<NotificationEmbed["fields"]>
}): NotificationEmbed {
  return {
    title: input.title,
    description: input.description ?? input.project.name,
    url: input.url,
    color: input.color ?? EMBED_COLOR.normal,
    fields: input.fields,
    author: embedAuthor(input.actor),
  }
}

export function taskDraftShell(input: {
  task: Doc<"tasks">
  rootName: string | null
  actor: Doc<"users"> | null
  target: NotificationTarget
  fallbackText: string
  title?: string
  description?: string
  url: string
  color?: number
  fields: NonNullable<NotificationEmbed["fields"]>
  buttons?: NotificationDraft["buttons"]
  viewButtonRow?: number
}): NotificationDraft {
  return {
    target: input.target,
    fallbackText: input.fallbackText,
    embeds: [
      buildTaskEmbed({
        task: input.task,
        rootName: input.rootName,
        actor: input.actor,
        url: input.url,
        title: input.title ?? input.fallbackText,
        description: input.description,
        color: input.color,
        fields: input.fields,
      }),
    ],
    buttons: [
      { kind: "url", label: "View", url: input.url, row: input.viewButtonRow },
      ...(input.buttons ?? []),
    ],
  }
}

export function competitionDraftShell(input: {
  competition: Doc<"competitions">
  actor: Doc<"users"> | null
  target: NotificationTarget
  fallbackText: string
  title?: string
  url: string
  color?: number
  description?: string
  fields: NonNullable<NotificationEmbed["fields"]>
  buttons?: NotificationDraft["buttons"]
  viewButtonRow?: number
}): NotificationDraft {
  return {
    target: input.target,
    fallbackText: input.fallbackText,
    embeds: [
      buildCompetitionEmbed({
        competition: input.competition,
        actor: input.actor,
        url: input.url,
        title: input.title ?? input.fallbackText,
        color: input.color,
        description: input.description,
        fields: input.fields,
      }),
    ],
    buttons: [
      {
        kind: "url",
        label: "View competition",
        url: input.url,
        row: input.viewButtonRow,
      },
      ...(input.buttons ?? []),
    ],
  }
}

export function projectDraftShell(input: {
  project: Doc<"projects">
  actor: Doc<"users"> | null
  target: NotificationTarget
  fallbackText: string
  title?: string
  url: string
  color?: number
  description?: string
  fields: NonNullable<NotificationEmbed["fields"]>
  buttons?: NotificationDraft["buttons"]
  viewButtonRow?: number
}): NotificationDraft {
  return {
    target: input.target,
    fallbackText: input.fallbackText,
    embeds: [
      buildProjectEmbed({
        project: input.project,
        actor: input.actor,
        url: input.url,
        title: input.title ?? input.fallbackText,
        color: input.color,
        description: input.description,
        fields: input.fields,
      }),
    ],
    buttons: [
      {
        kind: "url",
        label: "View project",
        url: input.url,
        row: input.viewButtonRow,
      },
      ...(input.buttons ?? []),
    ],
  }
}
