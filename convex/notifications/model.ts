import { internalQuery } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import {
  competitionDraftShell,
  EMBED_COLOR,
  embedField,
  isChannelTarget,
  statusLabel,
  taskDraftShell,
  truncateDiscordPreview,
  userDisplayName,
} from "@/convex/notifications/embeds"
import {
  notificationEvent,
  type NotificationDraft,
  type NotificationEvent,
  type NotificationTarget,
  type ResolvedNotificationDraft,
} from "@/convex/notifications/validators"
import { concreteAssigneeIds } from "@/convex/tasks/assignees"
import { getCompetitionForTask } from "@/convex/tasks/blockers/competition"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
import { hqSiteUrl } from "@/convex/plugins/sponsor/siteUrls"
import type { TaskReviewerRef } from "@/convex/tasks/reviews/validators"

const MAX_MANUAL_SUBSCRIBERS = 100
const MAX_TASK_REVIEWERS = 50
const MAX_TASK_INTEGRATIONS = 20

type ReadCtx = Pick<QueryCtx, "db">

function isoDateToUtcMs(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (match === null) return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function overdueLabel(dueDate: string, today: string | undefined): string {
  if (today === undefined) return `on **${dueDate}**`
  const dueMs = isoDateToUtcMs(dueDate)
  const todayMs = isoDateToUtcMs(today)
  if (dueMs === null || todayMs === null || todayMs <= dueMs) {
    return `on **${dueDate}**`
  }
  const dayCount = Math.round((todayMs - dueMs) / 86_400_000)
  return `**${String(dayCount)} day${dayCount === 1 ? "" : "s"} ago** (${dueDate})`
}

async function getActor(
  ctx: ReadCtx,
  actorId: Id<"users"> | null
): Promise<Doc<"users"> | null> {
  if (actorId === null) return null
  return await ctx.db.get("users", actorId)
}

async function reviewerDisplayName(
  ctx: ReadCtx,
  reviewer: TaskReviewerRef
): Promise<string> {
  if (reviewer.type === "users") {
    return userDisplayName(await ctx.db.get("users", reviewer.id))
  }
  const team = await ctx.db.get("teams", reviewer.id)
  return team?.name ?? "Unknown reviewer"
}

function canOfferStart(task: Doc<"tasks">): boolean {
  return task.status === "to-do"
}

function startTaskButton(
  taskId: Id<"tasks">
): NotificationDraft["buttons"][number] {
  return {
    kind: "action",
    label: "Start",
    action: { kind: "startTask", taskId },
  }
}

function startTaskButtonInRow(
  taskId: Id<"tasks">,
  row: number
): NotificationDraft["buttons"][number] {
  return { ...startTaskButton(taskId), row }
}

function taskUrl(taskId: Id<"tasks">) {
  return hqSiteUrl(`/tasks/${taskId}`)
}

function competitionUrl(competitionId: Id<"competitions">) {
  return hqSiteUrl(`/competitions/${competitionId}`)
}

function targetKey(target: ResolvedNotificationDraft["target"]) {
  return target.kind === "discordUser"
    ? `u:${target.discordUserId}`
    : `c:${target.channelId}`
}

function dedupeDrafts(drafts: ResolvedNotificationDraft[]) {
  const seen = new Set<string>()
  return drafts.filter((draft) => {
    const key = `${targetKey(draft.target)}:${draft.fallbackText}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function getTaskWatchers(
  ctx: ReadCtx,
  task: Doc<"tasks">
): Promise<Id<"users">[]> {
  const watcherIds = new Set<Id<"users">>(concreteAssigneeIds(task.assigneeIds))
  const subscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_object_type_and_object_id_and_userId", (q) =>
      q.eq("object.type", "tasks").eq("object.id", task._id)
    )
    .take(MAX_MANUAL_SUBSCRIBERS)
  for (const subscription of subscriptions) watcherIds.add(subscription.userId)
  return [...watcherIds]
}

async function getTaskSubscriberIds(
  ctx: ReadCtx,
  taskId: Id<"tasks">
): Promise<Id<"users">[]> {
  const subscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_object_type_and_object_id_and_userId", (q) =>
      q.eq("object.type", "tasks").eq("object.id", taskId)
    )
    .take(MAX_MANUAL_SUBSCRIBERS)
  return subscriptions.map((subscription) => subscription.userId)
}

async function getCompetitionSubscriberTargets(
  ctx: ReadCtx,
  competitionId: Id<"competitions">
): Promise<NotificationTarget[]> {
  const subscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_object_type_and_object_id_and_userId", (q) =>
      q.eq("object.type", "competitions").eq("object.id", competitionId)
    )
    .take(MAX_MANUAL_SUBSCRIBERS)
  return subscriptions.map((subscription) => ({
    kind: "user",
    userId: subscription.userId,
  }))
}

async function competitionChannelTarget(
  ctx: ReadCtx,
  competitionId: Id<"competitions">
): Promise<NotificationTarget[]> {
  const target = await getCompetitionChannelTarget(ctx, competitionId)
  return target === null ? [] : [target]
}

async function getCompetitionChannelTarget(
  ctx: ReadCtx,
  competitionId: Id<"competitions">
): Promise<Extract<NotificationTarget, { kind: "discordChannel" }> | null> {
  const resource = await ctx.db
    .query("competitionLinkedResources")
    .withIndex("by_competitionId_and_resourceType_and_resourceKey", (q) =>
      q
        .eq("competitionId", competitionId)
        .eq("resourceType", "discordChannel")
        .eq("resourceKey", "default")
    )
    .unique()
  return resource?.data.resourceType === "discordChannel"
    ? { kind: "discordChannel", channelId: resource.data.channelId }
    : null
}

async function competitionFeedTargets(
  ctx: ReadCtx,
  competitionId: Id<"competitions">
): Promise<NotificationTarget[]> {
  return [
    ...(await competitionChannelTarget(ctx, competitionId)),
    ...(await getCompetitionSubscriberTargets(ctx, competitionId)),
  ]
}

async function reviewerTargets(
  ctx: ReadCtx,
  task: Doc<"tasks">
): Promise<NotificationTarget[]> {
  const reviewers = await ctx.db
    .query("taskReviewers")
    .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
    .take(MAX_TASK_REVIEWERS)
  const targets: NotificationTarget[] = []
  const needsCompetitionChannel = reviewers.some(
    (reviewer) =>
      reviewer.approvedAt === null && reviewer.reviewer.type === "teams"
  )
  for (const reviewer of reviewers) {
    if (reviewer.approvedAt !== null || reviewer.reviewer.type !== "users") {
      continue
    }
    targets.push({ kind: "user", userId: reviewer.reviewer.id })
  }
  if (needsCompetitionChannel) {
    const competition = await getCompetitionForTask(ctx, task)
    if (competition !== null) {
      targets.push(...(await competitionChannelTarget(ctx, competition._id)))
    }
  }
  return targets
}

async function assignableTargets(
  ctx: ReadCtx,
  task: Doc<"tasks">
): Promise<NotificationTarget[]> {
  if (task.assigneeIds !== "assignable" || task.owner === null) return []
  if (task.owner.type === "users")
    return [{ kind: "user", userId: task.owner.id }]
  const teamId = task.owner.id
  const channel = await ctx.db
    .query("teamDiscordChannels")
    .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
    .unique()
  return channel !== null
    ? [{ kind: "discordChannel", channelId: channel.channelId }]
    : []
}

async function resolveTarget(
  ctx: ReadCtx,
  semanticTarget: NotificationTarget
): Promise<ResolvedNotificationDraft["target"] | null> {
  switch (semanticTarget.kind) {
    case "discordChannel":
      return { kind: "discordChannel", channelId: semanticTarget.channelId }
    case "user": {
      const user = await ctx.db.get("users", semanticTarget.userId)
      if (user?.disabled === true || user?.discordUserId === undefined) {
        return null
      }
      return { kind: "discordUser", discordUserId: user.discordUserId }
    }
  }
}

function suppressActorTarget(
  target: NotificationTarget,
  actorId: Id<"users"> | null
) {
  return actorId !== null && target.kind === "user" && target.userId === actorId
}

function actorSuppressionId(event: NotificationEvent): Id<"users"> | null {
  switch (event.kind) {
    case "taskAssigned":
    case "taskStatusChanged":
    case "taskAwaitingReview":
    case "taskReviewersChanged":
    case "competitionPhaseChanged":
    case "competitionUpdatePublished":
    case "sponsorSet":
      return event.actorId
    case "assignableTaskReady":
    case "taskUnblocked":
    case "taskDueSoon":
    case "taskOverdue":
    case "taskReminder":
    case "taskNudge":
    case "phaseOverdueTasks":
      return null
  }
}

async function resolveDrafts(
  ctx: ReadCtx,
  drafts: NotificationDraft[],
  actorId: Id<"users"> | null
): Promise<ResolvedNotificationDraft[]> {
  const resolved: ResolvedNotificationDraft[] = []
  for (const draft of drafts) {
    if (suppressActorTarget(draft.target, actorId)) continue
    const target = await resolveTarget(ctx, draft.target)
    if (target === null) continue
    resolved.push({ ...draft, target })
  }
  return dedupeDrafts(resolved)
}

async function addCanvaEnrichment(
  ctx: ReadCtx,
  draft: NotificationDraft,
  taskId: Id<"tasks">
): Promise<NotificationDraft> {
  const integrations = await ctx.db
    .query("taskIntegrations")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .take(MAX_TASK_INTEGRATIONS)
  const design = integrations.find(
    (row) => row.output?.kind === "canva_design"
  )?.output
  if (design?.kind !== "canva_design") return draft

  const filename = `canva-${taskId}.png`
  const attachments =
    design.thumbnailUrl !== undefined
      ? [
          ...(draft.attachments ?? []),
          {
            filename,
            url: design.thumbnailUrl,
          },
        ]
      : draft.attachments
  const [primaryEmbed, ...restEmbeds] = draft.embeds

  return {
    ...draft,
    embeds: [
      {
        ...primaryEmbed,
        fields: [
          ...(primaryEmbed.fields ?? []),
          {
            name: ":art: Design",
            value: `[Open linked Canva design](${design.designUrl})`,
          },
        ],
        imageAttachment:
          design.thumbnailUrl !== undefined
            ? filename
            : primaryEmbed.imageAttachment,
      },
      ...restEmbeds,
    ],
    buttons: [
      ...draft.buttons,
      { kind: "url", label: "Open Canva", url: design.designUrl },
    ],
    attachments,
  }
}

async function taskWatcherDrafts(
  ctx: ReadCtx,
  task: Doc<"tasks">,
  actor: Doc<"users"> | null,
  input: {
    fallbackText: string
    fields: NonNullable<NotificationDraft["embeds"][number]["fields"]>
    buttons?: NotificationDraft["buttons"]
    color?: number
  }
): Promise<NotificationDraft[]> {
  const [competition, watcherIds] = await Promise.all([
    getCompetitionForTask(ctx, task),
    getTaskWatchers(ctx, task),
  ])
  const url = taskUrl(task._id)
  const drafts = watcherIds.map((userId) =>
    taskDraftShell({
      task,
      competition,
      actor,
      target: { kind: "user", userId },
      fallbackText: input.fallbackText,
      url,
      color: input.color,
      fields: input.fields,
      buttons: input.buttons,
    })
  )
  return await Promise.all(
    drafts.map((draft) => addCanvaEnrichment(ctx, draft, task._id))
  )
}

async function buildTaskAssignedDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "taskAssigned" }>
): Promise<NotificationDraft[]> {
  const task = await ctx.db.get("tasks", event.taskId)
  if (task === null) return []
  const previousAssignees = event.previousAssigneeIds ?? []
  const nextAssignees = event.nextAssigneeIds ?? []
  const previous = new Set(previousAssignees)
  const next = new Set(nextAssignees)
  const added = nextAssignees.filter((userId) => !previous.has(userId))
  const removed = previousAssignees.filter((userId) => !next.has(userId))
  if (added.length === 0 && removed.length === 0) return []

  const [actor, competition, subscriberIds, addedUsers, removedUsers] =
    await Promise.all([
      getActor(ctx, event.actorId),
      getCompetitionForTask(ctx, task),
      getTaskSubscriberIds(ctx, task._id),
      Promise.all(added.map((userId) => ctx.db.get("users", userId))),
      Promise.all(removed.map((userId) => ctx.db.get("users", userId))),
    ])
  const recipientIds = new Set<Id<"users">>([
    ...previousAssignees,
    ...nextAssignees,
    ...subscriberIds,
  ])
  const eventLabel =
    added.length > 0 && removed.length > 0
      ? "Task Reassigned"
      : added.length > 0
        ? "Task Assigned"
        : "Task Unassigned"
  const fallbackText = `${eventLabel}: ${task.name}`
  const url = taskUrl(task._id)
  const actorName = userDisplayName(actor, "Someone")

  const drafts = [...recipientIds].map((userId) => {
    const fields: NonNullable<NotificationDraft["embeds"][number]["fields"]> = [
      embedField(
        ":bust_in_silhouette:",
        added.includes(userId)
          ? "Assigned by"
          : removed.includes(userId)
            ? "Removed by"
            : "Assignee Update",
        added.includes(userId)
          ? actorName
          : removed.includes(userId)
            ? actorName
            : `${actorName} updated assignees on this task.`
      ),
    ]
    if (addedUsers.length > 0) {
      fields.push(
        embedField(
          ":heavy_plus_sign:",
          "Assigned",
          addedUsers.map((user) => userDisplayName(user)).join(", "),
          removedUsers.length > 0
        )
      )
    }
    if (removedUsers.length > 0) {
      fields.push(
        embedField(
          ":heavy_minus_sign:",
          "Removed",
          removedUsers.map((user) => userDisplayName(user)).join(", "),
          addedUsers.length > 0
        )
      )
    }
    return taskDraftShell({
      task,
      competition,
      actor,
      target: { kind: "user", userId },
      fallbackText,
      url,
      fields,
    })
  })
  return await Promise.all(
    drafts.map((draft) => addCanvaEnrichment(ctx, draft, task._id))
  )
}

async function buildTaskStatusDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "taskStatusChanged" }>
): Promise<NotificationDraft[]> {
  const task = await ctx.db.get("tasks", event.taskId)
  if (task === null) return []
  const actor = await getActor(ctx, event.actorId)
  const previous = statusLabel(event.previousStatus)
  const next = statusLabel(event.nextStatus)
  return await taskWatcherDrafts(ctx, task, actor, {
    fallbackText: `Status changed: ${task.name}`,
    color:
      isTerminalComplete(task.status) && task.status === "done"
        ? EMBED_COLOR.success
        : EMBED_COLOR.normal,
    fields: [
      embedField(
        ":arrows_counterclockwise:",
        "Status Changed",
        `**${previous}** -> **${next}**`
      ),
    ],
  })
}

async function buildAwaitingReviewDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "taskAwaitingReview" }>
): Promise<NotificationDraft[]> {
  const task = await ctx.db.get("tasks", event.taskId)
  if (task === null) return []
  const [actor, competition, targets] = await Promise.all([
    getActor(ctx, event.actorId),
    getCompetitionForTask(ctx, task),
    reviewerTargets(ctx, task),
  ])
  const url = taskUrl(task._id)
  const drafts = targets.map((target) =>
    taskDraftShell({
      task,
      competition,
      actor,
      target,
      fallbackText: `Awaiting review: ${task.name}`,
      url,
      color: EMBED_COLOR.review,
      fields: [
        embedField(
          ":mag:",
          "Submitted by",
          isChannelTarget(target)
            ? `${userDisplayName(actor, "Someone")} marked this task as awaiting review.`
            : userDisplayName(actor, "Someone")
        ),
      ],
      buttons: [
        {
          kind: "action",
          label: "Approve",
          action: { kind: "approveTaskReview", taskId: task._id },
        },
      ],
    })
  )
  return await Promise.all(
    drafts.map((draft) => addCanvaEnrichment(ctx, draft, task._id))
  )
}

async function buildReviewersChangedDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "taskReviewersChanged" }>
): Promise<NotificationDraft[]> {
  const task = await ctx.db.get("tasks", event.taskId)
  if (task === null) return []
  const [actor, reviewerName] = await Promise.all([
    getActor(ctx, event.actorId),
    reviewerDisplayName(ctx, event.reviewer),
  ])
  const added = event.change === "added"
  return await taskWatcherDrafts(ctx, task, actor, {
    fallbackText: `${added ? "Reviewer added" : "Reviewer removed"}: ${task.name}`,
    color: EMBED_COLOR.review,
    fields: [
      embedField(
        added ? ":heavy_plus_sign:" : ":heavy_minus_sign:",
        "Reviewer",
        reviewerName,
        true
      ),
      embedField(
        ":pencil2:",
        "Changed by",
        userDisplayName(actor, "Someone"),
        true
      ),
    ],
  })
}

async function buildAssignableDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "assignableTaskReady" }>
) {
  const task = await ctx.db.get("tasks", event.taskId)
  if (task === null) return []
  const [actor, competition, targets] = await Promise.all([
    getActor(ctx, event.actorId),
    getCompetitionForTask(ctx, task),
    assignableTargets(ctx, task),
  ])
  const url = taskUrl(task._id)
  const drafts = targets.map((target) =>
    taskDraftShell({
      task,
      competition,
      actor,
      target,
      fallbackText: `Ready to claim: ${task.name}`,
      url,
      fields: [
        embedField(
          ":raising_hand:",
          "Ready to Claim",
          isChannelTarget(target)
            ? "This task is ready for someone on the team to claim."
            : "This task is ready for you to claim."
        ),
      ],
      buttons: [
        {
          kind: "action",
          label: "Claim",
          action: { kind: "claimTask", taskId: task._id },
        },
      ],
    })
  )
  return await Promise.all(
    drafts.map((draft) => addCanvaEnrichment(ctx, draft, task._id))
  )
}

async function buildDueTaskDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "taskDueSoon" | "taskOverdue" }>
): Promise<NotificationDraft[]> {
  const task = await ctx.db.get("tasks", event.taskId)
  if (task === null) return []
  const [competition, watcherIds] = await Promise.all([
    getCompetitionForTask(ctx, task),
    event.kind === "taskOverdue"
      ? getTaskWatchers(ctx, task)
      : Promise.resolve(concreteAssigneeIds(task.assigneeIds)),
  ])
  const overdue = event.kind === "taskOverdue"
  const dueValue =
    event.kind === "taskOverdue"
      ? `This task was due ${overdueLabel(event.dueDate, event.today)}.`
      : `This task is due on **${event.dueDate}**.`
  const url = taskUrl(task._id)
  const drafts = watcherIds.map((userId) =>
    taskDraftShell({
      task,
      competition,
      actor: null,
      target: { kind: "user", userId },
      fallbackText: `${overdue ? "Overdue" : "Due soon"}: ${task.name}`,
      url,
      color: overdue ? EMBED_COLOR.urgent : EMBED_COLOR.warning,
      fields: [
        embedField(":alarm_clock:", overdue ? "Overdue" : "Due Soon", dueValue),
      ],
      buttons: canOfferStart(task) ? [startTaskButton(task._id)] : [],
    })
  )
  return await Promise.all(
    drafts.map((draft) => addCanvaEnrichment(ctx, draft, task._id))
  )
}

async function buildReminderDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "taskReminder" }>
): Promise<NotificationDraft[]> {
  const reminder = await ctx.db.get("taskReminders", event.reminderId)
  if (reminder === null) return []
  if (
    reminder.cancelledAt !== null ||
    reminder.sentAt !== null ||
    reminder.failedAt !== null
  ) {
    return []
  }
  const task = await ctx.db.get("tasks", reminder.taskId)
  if (task === null) return []
  const competition = await getCompetitionForTask(ctx, task)
  const reminderText =
    truncateDiscordPreview(reminder.message ?? undefined) ||
    "You asked to be reminded about this task."
  const url = taskUrl(task._id)
  return await Promise.all(
    [
      taskDraftShell({
        task,
        competition,
        actor: null,
        target: { kind: "user", userId: reminder.userId },
        fallbackText: `Reminder: ${task.name}`,
        url,
        viewButtonRow: 1,
        fields: [embedField(":alarm_clock:", "Reminder", reminderText)],
        buttons: [
          {
            kind: "action",
            label: "Snooze 1h",
            row: 0,
            action: {
              kind: "snoozeReminder",
              reminderId: reminder._id,
              preset: "1h",
            },
          },
          {
            kind: "action",
            label: "Tomorrow",
            row: 0,
            action: {
              kind: "snoozeReminder",
              reminderId: reminder._id,
              preset: "tomorrow",
            },
          },
          {
            kind: "url",
            label: "Custom time",
            url,
            row: 0,
          },
          ...(canOfferStart(task) ? [startTaskButtonInRow(task._id, 1)] : []),
        ],
      }),
    ].map((draft) => addCanvaEnrichment(ctx, draft, task._id))
  )
}

async function buildNudgeDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "taskNudge" }>
) {
  const task = await ctx.db.get("tasks", event.taskId)
  if (task === null) return []
  const [actor, competition] = await Promise.all([
    getActor(ctx, event.actorId),
    getCompetitionForTask(ctx, task),
  ])
  const actorName = userDisplayName(actor, "Someone")
  const url = taskUrl(task._id)
  const drafts = event.recipientIds
    .filter((userId) => concreteAssigneeIds(task.assigneeIds).includes(userId))
    .map((userId) =>
      taskDraftShell({
        task,
        competition,
        actor,
        target: { kind: "user", userId },
        fallbackText: `Nudge: ${task.name}`,
        url,
        fields: [
          embedField(
            ":wave:",
            "Friendly Nudge",
            `${actorName} flagged this task needs attention.`
          ),
        ],
      })
    )
  return await Promise.all(
    drafts.map((draft) => addCanvaEnrichment(ctx, draft, task._id))
  )
}

async function buildCompetitionFeedDrafts(
  ctx: ReadCtx,
  competitionId: Id<"competitions">,
  input: {
    fallbackText: string
    fields: NonNullable<NotificationDraft["embeds"][number]["fields"]>
    actorId: Id<"users"> | null
    color?: number
    description?: string
    buttons?: NotificationDraft["buttons"]
  }
): Promise<NotificationDraft[]> {
  const [competition, actor, targets] = await Promise.all([
    ctx.db.get("competitions", competitionId),
    getActor(ctx, input.actorId),
    competitionFeedTargets(ctx, competitionId),
  ])
  if (competition === null) return []
  const url = competitionUrl(competitionId)
  return targets.map((target) =>
    competitionDraftShell({
      competition,
      actor,
      target,
      fallbackText: input.fallbackText,
      url,
      color: input.color,
      description: input.description,
      fields: input.fields,
      buttons: input.buttons,
    })
  )
}

async function buildPhaseChangedDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "competitionPhaseChanged" }>
) {
  const [competition, previousPhase, nextPhase] = await Promise.all([
    ctx.db.get("competitions", event.competitionId),
    event.previousPhaseId === null
      ? null
      : ctx.db.get("phases", event.previousPhaseId),
    ctx.db.get("phases", event.nextPhaseId),
  ])
  const previous = previousPhase?.name ?? "No phase"
  const next = nextPhase?.name ?? "Unknown phase"
  return await buildCompetitionFeedDrafts(ctx, event.competitionId, {
    fallbackText: `Phase changed: ${competition?.name ?? "competition"}`,
    actorId: event.actorId,
    description:
      competition !== null
        ? `${competition.name} has advanced to a new phase. Review updated task lists and deadlines.`
        : undefined,
    fields: [
      embedField(
        ":twisted_rightwards_arrows:",
        "Phase Changed",
        `**${previous}** -> **${next}**`
      ),
    ],
  })
}

async function buildUpdateDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "competitionUpdatePublished" }>
) {
  const [update, competition] = await Promise.all([
    ctx.db.get("competitionUpdates", event.updateId),
    ctx.db.get("competitions", event.competitionId),
  ])
  if (update === null) return []
  const preview = truncateDiscordPreview(update.body)
  return await buildCompetitionFeedDrafts(ctx, event.competitionId, {
    fallbackText: `Update: ${competition?.name ?? "competition"}`,
    actorId: event.actorId,
    fields: [
      embedField(
        ":memo:",
        "Competition Update",
        preview.length > 0 ? preview : "A new update was published."
      ),
    ],
  })
}

async function buildSponsorSetDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "sponsorSet" }>
) {
  const competition = await ctx.db.get("competitions", event.competitionId)
  const sponsorValue =
    event.sponsorName !== null
      ? `Sponsor set to **${event.sponsorName}**.`
      : "Sponsor status changed."
  return await buildCompetitionFeedDrafts(ctx, event.competitionId, {
    fallbackText: `Sponsor updated: ${competition?.name ?? "competition"}`,
    actorId: event.actorId,
    fields: [embedField(":handshake:", "Sponsor Updated", sponsorValue)],
  })
}

async function buildPhaseOverdueDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "phaseOverdueTasks" }>
): Promise<NotificationDraft[]> {
  const [competition, phase] = await Promise.all([
    ctx.db.get("competitions", event.competitionId),
    ctx.db.get("phases", event.previousPhaseId),
  ])
  if (competition === null || phase === null) return []

  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
      q.eq("parent.type", "phases").eq("parent.id", event.previousPhaseId)
    )
    .take(100)
  const openRootTasks = tasks.filter((task) => !isTerminalComplete(task.status))
  const draftEntries: { draft: NotificationDraft; taskId: Id<"tasks"> }[] = []
  for (const task of openRootTasks) {
    const watcherIds = await getTaskWatchers(ctx, task)
    const url = taskUrl(task._id)
    for (const userId of watcherIds) {
      draftEntries.push({
        taskId: task._id,
        draft: taskDraftShell({
          task,
          competition,
          actor: null,
          target: { kind: "user", userId },
          fallbackText: `Open task after phase change: ${task.name}`,
          url,
          color: EMBED_COLOR.warning,
          fields: [
            embedField(
              ":triangular_flag_on_post:",
              "Open After Phase Change",
              `${competition.name} moved on from **${phase.name}**, but this task is still open and unresolved.`
            ),
          ],
        }),
      })
    }
  }
  return await Promise.all(
    draftEntries.map(({ draft, taskId }) =>
      addCanvaEnrichment(ctx, draft, taskId)
    )
  )
}

async function buildEventDrafts(
  ctx: ReadCtx,
  event: NotificationEvent
): Promise<NotificationDraft[]> {
  switch (event.kind) {
    case "taskAssigned":
      return await buildTaskAssignedDrafts(ctx, event)
    case "taskStatusChanged":
      return await buildTaskStatusDrafts(ctx, event)
    case "taskAwaitingReview":
      return await buildAwaitingReviewDrafts(ctx, event)
    case "taskReviewersChanged":
      return await buildReviewersChangedDrafts(ctx, event)
    case "assignableTaskReady":
      return await buildAssignableDrafts(ctx, event)
    case "taskUnblocked": {
      const task = await ctx.db.get("tasks", event.taskId)
      if (task === null) return []
      const actor = await getActor(ctx, event.actorId)
      return await taskWatcherDrafts(ctx, task, actor, {
        fallbackText: `Unblocked: ${task.name}`,
        color: EMBED_COLOR.success,
        fields: [
          embedField(
            ":white_check_mark:",
            "Task Unblocked",
            `${userDisplayName(actor, "Someone")} cleared all blockers for this task.`
          ),
        ],
      })
    }
    case "taskDueSoon":
    case "taskOverdue":
      return await buildDueTaskDrafts(ctx, event)
    case "taskReminder":
      return await buildReminderDrafts(ctx, event)
    case "taskNudge":
      return await buildNudgeDrafts(ctx, event)
    case "competitionPhaseChanged":
      return await buildPhaseChangedDrafts(ctx, event)
    case "phaseOverdueTasks":
      return await buildPhaseOverdueDrafts(ctx, event)
    case "competitionUpdatePublished":
      return await buildUpdateDrafts(ctx, event)
    case "sponsorSet":
      return await buildSponsorSetDrafts(ctx, event)
  }
}

export const resolveEventDrafts = internalQuery({
  args: { event: notificationEvent },
  handler: async (ctx, args) => {
    return await resolveDrafts(
      ctx,
      await buildEventDrafts(ctx, args.event),
      actorSuppressionId(args.event)
    )
  },
})
