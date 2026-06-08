import { v, type Infer } from "convex/values"
import { taskReviewerRef } from "@/convex/tasks/reviews/validators"

export const dueNoticeKind = v.union(
  v.literal("due-soon"),
  v.literal("overdue")
)

export const taskReminderFields = {
  taskId: v.id("tasks"),
  userId: v.id("users"),
  remindAt: v.number(),
  message: v.union(v.string(), v.null()),
  scheduledFunctionId: v.union(v.id("_scheduled_functions"), v.null()),
  sentAt: v.union(v.number(), v.null()),
  cancelledAt: v.union(v.number(), v.null()),
  failedAt: v.union(v.number(), v.null()),
  lastError: v.union(v.string(), v.null()),
}

export const taskDueNoticeStateFields = {
  taskId: v.id("tasks"),
  dueDate: v.string(),
  kind: dueNoticeKind,
  sentAt: v.number(),
}

export const taskNudgeCooldownFields = {
  taskId: v.id("tasks"),
  assigneeId: v.id("users"),
  lastNudgedAt: v.number(),
}

export const notificationTarget = v.union(
  v.object({
    kind: v.literal("user"),
    userId: v.id("users"),
  }),
  v.object({
    kind: v.literal("discordChannel"),
    channelId: v.string(),
  })
)

export const notificationAction = v.union(
  v.object({
    kind: v.literal("claimTask"),
    taskId: v.id("tasks"),
  }),
  v.object({
    kind: v.literal("approveTaskReview"),
    taskId: v.id("tasks"),
  }),
  v.object({
    kind: v.literal("startTask"),
    taskId: v.id("tasks"),
  }),
  v.object({
    kind: v.literal("snoozeReminder"),
    reminderId: v.id("taskReminders"),
    preset: v.union(v.literal("1h"), v.literal("tomorrow")),
  })
)

export const notificationEvent = v.union(
  v.object({
    kind: v.literal("taskAssigned"),
    taskId: v.id("tasks"),
    actorId: v.union(v.id("users"), v.null()),
    previousAssigneeIds: v.union(v.array(v.id("users")), v.null()),
    nextAssigneeIds: v.union(v.array(v.id("users")), v.null()),
  }),
  v.object({
    kind: v.literal("taskStatusChanged"),
    taskId: v.id("tasks"),
    actorId: v.union(v.id("users"), v.null()),
    previousStatus: v.string(),
    nextStatus: v.string(),
  }),
  v.object({
    kind: v.literal("taskAwaitingReview"),
    taskId: v.id("tasks"),
    actorId: v.union(v.id("users"), v.null()),
  }),
  v.object({
    kind: v.literal("taskReviewersChanged"),
    taskId: v.id("tasks"),
    actorId: v.union(v.id("users"), v.null()),
    change: v.union(v.literal("added"), v.literal("removed")),
    reviewer: taskReviewerRef,
  }),
  v.object({
    kind: v.literal("assignableTaskReady"),
    taskId: v.id("tasks"),
    actorId: v.union(v.id("users"), v.null()),
  }),
  v.object({
    kind: v.literal("taskUnblocked"),
    taskId: v.id("tasks"),
    actorId: v.union(v.id("users"), v.null()),
  }),
  v.object({
    kind: v.literal("taskDueSoon"),
    taskId: v.id("tasks"),
    dueDate: v.string(),
  }),
  v.object({
    kind: v.literal("taskOverdue"),
    taskId: v.id("tasks"),
    dueDate: v.string(),
    today: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("taskReminder"),
    reminderId: v.id("taskReminders"),
  }),
  v.object({
    kind: v.literal("taskNudge"),
    taskId: v.id("tasks"),
    actorId: v.id("users"),
    recipientIds: v.array(v.id("users")),
  }),
  v.object({
    kind: v.literal("competitionPhaseChanged"),
    competitionId: v.id("competitions"),
    actorId: v.union(v.id("users"), v.null()),
    previousPhaseId: v.union(v.id("phases"), v.null()),
    nextPhaseId: v.id("phases"),
  }),
  v.object({
    kind: v.literal("phaseOverdueTasks"),
    competitionId: v.id("competitions"),
    actorId: v.union(v.id("users"), v.null()),
    previousPhaseId: v.id("phases"),
  }),
  v.object({
    kind: v.literal("competitionUpdatePublished"),
    competitionId: v.id("competitions"),
    updateId: v.id("competitionUpdates"),
    actorId: v.union(v.id("users"), v.null()),
  }),
  v.object({
    kind: v.literal("sponsorSet"),
    competitionId: v.id("competitions"),
    actorId: v.union(v.id("users"), v.null()),
    sponsorName: v.union(v.string(), v.null()),
  })
)

export const notificationAttachmentRequest = v.object({
  filename: v.string(),
  url: v.string(),
})

export const notificationButton = v.union(
  v.object({
    kind: v.literal("url"),
    label: v.string(),
    url: v.string(),
    row: v.optional(v.number()),
  }),
  v.object({
    kind: v.literal("action"),
    label: v.string(),
    action: notificationAction,
    row: v.optional(v.number()),
  })
)

export const notificationEmbedField = v.object({
  name: v.string(),
  value: v.string(),
  inline: v.optional(v.boolean()),
})

export const notificationEmbedAuthor = v.object({
  name: v.string(),
  iconUrl: v.optional(v.string()),
})

export const notificationEmbedFooter = v.object({
  text: v.string(),
  iconUrl: v.optional(v.string()),
})

export const notificationEmbed = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  url: v.optional(v.string()),
  color: v.optional(v.number()),
  fields: v.optional(v.array(notificationEmbedField)),
  author: v.optional(notificationEmbedAuthor),
  footer: v.optional(notificationEmbedFooter),
  timestamp: v.optional(v.string()),
  imageAttachment: v.optional(v.string()),
})

export const notificationDraft = v.object({
  target: notificationTarget,
  fallbackText: v.string(),
  embeds: v.array(notificationEmbed),
  buttons: v.array(notificationButton),
  attachments: v.optional(v.array(notificationAttachmentRequest)),
})

export const resolvedNotificationDraft = v.object({
  target: v.union(
    v.object({
      kind: v.literal("discordUser"),
      discordUserId: v.string(),
    }),
    v.object({
      kind: v.literal("discordChannel"),
      channelId: v.string(),
    })
  ),
  fallbackText: v.string(),
  embeds: v.array(notificationEmbed),
  buttons: v.array(notificationButton),
  attachments: v.optional(v.array(notificationAttachmentRequest)),
})

export type DueNoticeKind = Infer<typeof dueNoticeKind>
export type NotificationAttachmentRequest = Infer<
  typeof notificationAttachmentRequest
>
export type NotificationTarget = Infer<typeof notificationTarget>
export type NotificationAction = Infer<typeof notificationAction>
export type NotificationEvent = Infer<typeof notificationEvent>
export type NotificationEmbed = Infer<typeof notificationEmbed>
export type NotificationDraft = Infer<typeof notificationDraft>
export type ResolvedNotificationDraft = Infer<typeof resolvedNotificationDraft>
