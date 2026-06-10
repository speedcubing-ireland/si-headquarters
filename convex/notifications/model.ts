import { internalQuery } from "@/convex/_generated/server"
import { v } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import {
  competitionDraftShell,
  EMBED_COLOR,
  embedField,
  isChannelTarget,
  projectDraftShell,
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
import {
  getCompetitionForTask,
  loadTaskRootDocs,
} from "@/convex/tasks/hierarchy"
import {
  getTaskSubscriberIds,
  getTaskWatcherIds,
  MAX_MANUAL_SUBSCRIBERS,
} from "@/convex/tasks/watchers"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
import { hqSiteUrl } from "@/convex/urls"
import type { TaskReviewerRef } from "@/convex/tasks/reviews/validators"
import { getLinkedDiscordChannelTarget } from "@/convex/integrations/objectResources"
import { getProjectWorkflowDefinition } from "@/convex/projectWorkflows/registry"
import { enrichTaskNotificationDraft } from "@/convex/notifications/enrichers"

const MAX_PROJECT_MEMBERS = 100
const MAX_PROJECT_NOTIFICATION_TEAM_MEMBERS = 100
const MAX_TASK_REVIEWERS = 50

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

function projectUrl(projectId: Id<"projects">) {
  return hqSiteUrl(`/projects/${projectId}`)
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

async function getTaskOwnerChannelTarget(
  ctx: ReadCtx,
  task: Doc<"tasks">
): Promise<NotificationTarget | null> {
  if (task.root.type === "competitions") {
    const targets = await competitionChannelTarget(ctx, task.root.id)
    return targets[0] ?? null
  }
  return await getLinkedDiscordChannelTarget(ctx, {
    type: "projects",
    id: task.root.id,
  })
}

async function buildTaskAlertDrafts(
  ctx: ReadCtx,
  task: Doc<"tasks">,
  input: {
    fallbackText: string
    fields: NonNullable<NotificationDraft["embeds"][number]["fields"]>
    color: number
    buttons?: NotificationDraft["buttons"]
    includeOwnerChannel: boolean
    watcherIds: Id<"users">[]
  }
): Promise<NotificationDraft[]> {
  const { name } = await loadTaskRootDocs(ctx, task)
  const url = taskUrl(task._id)
  const targets: NotificationTarget[] = input.watcherIds.map((userId) => ({
    kind: "user",
    userId,
  }))
  if (input.includeOwnerChannel) {
    const channelTarget = await getTaskOwnerChannelTarget(ctx, task)
    if (channelTarget !== null) targets.push(channelTarget)
  }

  const drafts = targets.map((target) =>
    taskDraftShell({
      task,
      rootName: name,
      actor: null,
      target,
      fallbackText: input.fallbackText,
      url,
      color: input.color,
      fields: input.fields,
      buttons: input.buttons,
    })
  )
  return await Promise.all(
    drafts.map((draft) => enrichTaskNotificationDraft(ctx, draft, task._id))
  )
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

async function getProjectSubscriberIds(
  ctx: ReadCtx,
  projectId: Id<"projects">
): Promise<Id<"users">[]> {
  const subscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_object_type_and_object_id_and_userId", (q) =>
      q.eq("object.type", "projects").eq("object.id", projectId)
    )
    .take(MAX_MANUAL_SUBSCRIBERS)
  return subscriptions.map((subscription) => subscription.userId)
}

async function getProjectParticipantIds(
  ctx: ReadCtx,
  project: Doc<"projects">
): Promise<Id<"users">[]> {
  const userIds = new Set<Id<"users">>()
  if (project.leadUserId !== null) {
    userIds.add(project.leadUserId)
  }

  const members = await ctx.db
    .query("projectMembers")
    .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
    .take(MAX_PROJECT_MEMBERS + 1)
  if (members.length > MAX_PROJECT_MEMBERS) {
    throw new Error("Project has too many members for notifications.")
  }

  for (const member of members) {
    const memberRef = member.member
    if (memberRef.type === "users") {
      userIds.add(memberRef.id)
      continue
    }

    const teamMemberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_teamId_and_userId", (q) => q.eq("teamId", memberRef.id))
      .take(MAX_PROJECT_NOTIFICATION_TEAM_MEMBERS + 1)
    if (teamMemberships.length > MAX_PROJECT_NOTIFICATION_TEAM_MEMBERS) {
      throw new Error("Project member team has too many notification targets.")
    }
    for (const teamMembership of teamMemberships)
      userIds.add(teamMembership.userId)
  }

  return [...userIds]
}

async function projectFeedTargets(
  ctx: ReadCtx,
  project: Doc<"projects">
): Promise<NotificationTarget[]> {
  const channelTarget = await getLinkedDiscordChannelTarget(ctx, {
    type: "projects",
    id: project._id,
  })
  const targetUserIds = new Set<Id<"users">>([
    ...(await getProjectSubscriberIds(ctx, project._id)),
    ...(await getProjectParticipantIds(ctx, project)),
  ])
  return [
    ...(channelTarget === null ? [] : [channelTarget]),
    ...[...targetUserIds].map((userId) => ({ kind: "user" as const, userId })),
  ]
}

async function competitionChannelTarget(
  ctx: ReadCtx,
  competitionId: Id<"competitions">
): Promise<NotificationTarget[]> {
  const target = await getLinkedDiscordChannelTarget(ctx, {
    type: "competitions",
    id: competitionId,
  })
  return target === null ? [] : [target]
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
    case "phaseChanged":
    case "updatePublished":
    case "sponsorSet":
      return event.actorId
    case "projectWorkflowAttention":
    case "assignableTaskReady":
    case "taskUnblocked":
    case "taskDueSoon":
    case "taskOverdue":
    case "ownerOverdueSummary":
    case "taskReminder":
    case "taskNudge":
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
  const [{ name }, watcherIds] = await Promise.all([
    loadTaskRootDocs(ctx, task),
    getTaskWatcherIds(ctx, task),
  ])
  const url = taskUrl(task._id)
  const drafts = watcherIds.map((userId) =>
    taskDraftShell({
      task,
      rootName: name,
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
    drafts.map((draft) => enrichTaskNotificationDraft(ctx, draft, task._id))
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

  const [actor, { name }, subscriberIds, addedUsers, removedUsers] =
    await Promise.all([
      getActor(ctx, event.actorId),
      loadTaskRootDocs(ctx, task),
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
      rootName: name,
      actor,
      target: { kind: "user", userId },
      fallbackText,
      url,
      fields,
    })
  })
  return await Promise.all(
    drafts.map((draft) => enrichTaskNotificationDraft(ctx, draft, task._id))
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
  const [actor, { name }, targets] = await Promise.all([
    getActor(ctx, event.actorId),
    loadTaskRootDocs(ctx, task),
    reviewerTargets(ctx, task),
  ])
  const url = taskUrl(task._id)
  const drafts = targets.map((target) =>
    taskDraftShell({
      task,
      rootName: name,
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
    drafts.map((draft) => enrichTaskNotificationDraft(ctx, draft, task._id))
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
  const [actor, { name }, targets] = await Promise.all([
    getActor(ctx, event.actorId),
    loadTaskRootDocs(ctx, task),
    assignableTargets(ctx, task),
  ])
  const url = taskUrl(task._id)
  const drafts = targets.map((target) =>
    taskDraftShell({
      task,
      rootName: name,
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
    drafts.map((draft) => enrichTaskNotificationDraft(ctx, draft, task._id))
  )
}

async function buildDueTaskDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "taskDueSoon" | "taskOverdue" }>
): Promise<NotificationDraft[]> {
  const task = await ctx.db.get("tasks", event.taskId)
  if (task === null) return []

  if (event.kind === "taskDueSoon") {
    return await buildTaskAlertDrafts(ctx, task, {
      watcherIds: concreteAssigneeIds(task.assigneeIds),
      includeOwnerChannel: false,
      fallbackText: `Due soon: ${task.name}`,
      color: EMBED_COLOR.warning,
      fields: [
        embedField(
          ":alarm_clock:",
          "Due Soon",
          `This task is due on **${event.dueDate}**.`
        ),
      ],
      buttons: canOfferStart(task) ? [startTaskButton(task._id)] : [],
    })
  }

  const { name } = await loadTaskRootDocs(ctx, task)
  const url = taskUrl(task._id)
  const dueValue =
    task.dueDate !== null
      ? `This task was due ${overdueLabel(task.dueDate, event.today)}.`
      : "This task is overdue and still needs attention."

  const draft = taskDraftShell({
    task,
    rootName: name,
    actor: null,
    target: { kind: "user", userId: event.recipientId },
    fallbackText: `Overdue: ${task.name}`,
    url,
    color: EMBED_COLOR.urgent,
    fields: [embedField(":alarm_clock:", "Overdue", dueValue)],
    buttons: canOfferStart(task) ? [startTaskButton(task._id)] : [],
  })
  return [await enrichTaskNotificationDraft(ctx, draft, task._id)]
}

async function buildOwnerOverdueSummaryDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "ownerOverdueSummary" }>
): Promise<NotificationDraft[]> {
  const [owner, tasks] = await Promise.all([
    getScopedObjectName(ctx, event.owner),
    Promise.all(event.taskIds.map((taskId) => ctx.db.get("tasks", taskId))),
  ])
  const openTasks = tasks.filter(
    (task): task is Doc<"tasks"> =>
      task !== null && !isTerminalComplete(task.status)
  )
  if (openTasks.length === 0) return []

  const lines = openTasks.map(
    (task) => `• [${task.name}](${taskUrl(task._id)})`
  )
  const summaryValue = lines.join("\n")
  const countLabel = `${String(openTasks.length)} overdue task${
    openTasks.length === 1 ? "" : "s"
  }`

  return await buildObjectFeedDrafts(ctx, event.owner, {
    fallbackText: `${countLabel}: ${owner.name}`,
    actorId: null,
    color: EMBED_COLOR.urgent,
    fields: [
      embedField(
        ":alarm_clock:",
        "Overdue Tasks",
        `${countLabel} still need attention in **${owner.name}**:\n${summaryValue}`
      ),
    ],
  })
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
  const { name } = await loadTaskRootDocs(ctx, task)
  const reminderText =
    truncateDiscordPreview(reminder.message ?? undefined) ||
    "You asked to be reminded about this task."
  const url = taskUrl(task._id)
  return await Promise.all(
    [
      taskDraftShell({
        task,
        rootName: name,
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
    ].map((draft) => enrichTaskNotificationDraft(ctx, draft, task._id))
  )
}

async function buildNudgeDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "taskNudge" }>
) {
  const task = await ctx.db.get("tasks", event.taskId)
  if (task === null) return []
  const [actor, { name }] = await Promise.all([
    getActor(ctx, event.actorId),
    loadTaskRootDocs(ctx, task),
  ])
  const actorName = userDisplayName(actor, "Someone")
  const url = taskUrl(task._id)
  const drafts = event.recipientIds
    .filter((userId) => concreteAssigneeIds(task.assigneeIds).includes(userId))
    .map((userId) =>
      taskDraftShell({
        task,
        rootName: name,
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
    drafts.map((draft) => enrichTaskNotificationDraft(ctx, draft, task._id))
  )
}

async function buildCompetitionFeedDrafts(
  ctx: ReadCtx,
  competitionId: Id<"competitions">,
  input: {
    fallbackText: string
    title?: string
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

async function buildProjectFeedDrafts(
  ctx: ReadCtx,
  projectId: Id<"projects">,
  input: {
    fallbackText: string
    title?: string
    fields: NonNullable<NotificationDraft["embeds"][number]["fields"]>
    actorId: Id<"users"> | null
    color?: number
    description?: string
    buttons?: NotificationDraft["buttons"]
  }
): Promise<NotificationDraft[]> {
  const [project, actor] = await Promise.all([
    ctx.db.get("projects", projectId),
    getActor(ctx, input.actorId),
  ])
  if (project === null) return []
  const targets = await projectFeedTargets(ctx, project)
  const url = projectUrl(projectId)
  return targets.map((target) =>
    projectDraftShell({
      project,
      actor,
      target,
      fallbackText: input.fallbackText,
      title: input.title,
      url,
      color: input.color,
      description: input.description,
      fields: input.fields,
      buttons: input.buttons,
    })
  )
}

interface ObjectFeedInput {
  fallbackText: string
  title?: string
  fields: NonNullable<NotificationDraft["embeds"][number]["fields"]>
  actorId: Id<"users"> | null
  color?: number
  description?: string
  buttons?: NotificationDraft["buttons"]
}

async function buildObjectFeedDrafts(
  ctx: ReadCtx,
  object:
    | { type: "competitions"; id: Id<"competitions"> }
    | { type: "projects"; id: Id<"projects"> },
  input: ObjectFeedInput
): Promise<NotificationDraft[]> {
  if (object.type === "competitions") {
    return await buildCompetitionFeedDrafts(ctx, object.id, input)
  }
  return await buildProjectFeedDrafts(ctx, object.id, input)
}

async function getScopedObjectName(
  ctx: ReadCtx,
  object:
    | { type: "competitions"; id: Id<"competitions"> }
    | { type: "projects"; id: Id<"projects"> }
) {
  if (object.type === "competitions") {
    const competition = await ctx.db.get("competitions", object.id)
    return {
      name: competition?.name ?? "competition",
      label: "competition" as const,
    }
  }
  const project = await ctx.db.get("projects", object.id)
  return {
    name: project?.name ?? "project",
    label: "project" as const,
  }
}

async function buildPhaseChangedDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "phaseChanged" }>
) {
  const [previousPhase, nextPhase, owner] = await Promise.all([
    event.previousPhaseId === null
      ? null
      : ctx.db.get("phases", event.previousPhaseId),
    ctx.db.get("phases", event.nextPhaseId),
    getScopedObjectName(ctx, event.object),
  ])
  const previous = previousPhase?.name ?? "No phase"
  const next = nextPhase?.name ?? "Unknown phase"
  return await buildObjectFeedDrafts(ctx, event.object, {
    fallbackText: `Phase changed: ${owner.name}`,
    title:
      owner.label === "project"
        ? `Project Phase Changed: ${owner.name}`
        : undefined,
    actorId: event.actorId,
    description: `${owner.name} has advanced to a new phase. Review updated task lists and deadlines.`,
    fields: [
      embedField(
        ":twisted_rightwards_arrows:",
        "Phase Changed",
        `**${previous}** -> **${next}**`
      ),
    ],
  })
}

async function buildUpdatePublishedDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "updatePublished" }>
) {
  const [update, owner] = await Promise.all([
    ctx.db.get("objectUpdates", event.updateId),
    getScopedObjectName(ctx, event.object),
  ])
  if (update === null) return []
  const preview = truncateDiscordPreview(update.body)
  const objectLabel = owner.label === "project" ? "Project" : "Competition"
  return await buildObjectFeedDrafts(ctx, event.object, {
    fallbackText: `Update: ${owner.name}`,
    title:
      owner.label === "project" ? `Project Update: ${owner.name}` : undefined,
    actorId: event.actorId,
    fields: [
      embedField(
        ":memo:",
        `${objectLabel} Update`,
        preview.length > 0 ? preview : "A new update was published."
      ),
    ],
  })
}

async function buildProjectWorkflowAttentionDrafts(
  ctx: ReadCtx,
  event: Extract<NotificationEvent, { kind: "projectWorkflowAttention" }>
) {
  const [project, run] = await Promise.all([
    ctx.db.get("projects", event.projectId),
    ctx.db.get("workflowRuns", event.workflowRunId),
  ])
  if (project === null || run === null || project.leadUserId === null) return []
  const definition = getProjectWorkflowDefinition(run.workflowId)
  const url = projectUrl(project._id)
  return [
    projectDraftShell({
      project,
      actor: null,
      target: { kind: "user", userId: project.leadUserId },
      fallbackText: `Workflow needs attention: ${project.name}`,
      title: `Workflow Needs Attention: ${project.name}`,
      url,
      fields: [
        embedField(
          ":twisted_rightwards_arrows:",
          definition.label,
          run.summary ?? "This workflow needs attention."
        ),
      ],
    }),
  ]
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
    case "ownerOverdueSummary":
      return await buildOwnerOverdueSummaryDrafts(ctx, event)
    case "taskReminder":
      return await buildReminderDrafts(ctx, event)
    case "taskNudge":
      return await buildNudgeDrafts(ctx, event)
    case "phaseChanged":
      return await buildPhaseChangedDrafts(ctx, event)
    case "updatePublished":
      return await buildUpdatePublishedDrafts(ctx, event)
    case "projectWorkflowAttention":
      return await buildProjectWorkflowAttentionDrafts(ctx, event)
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

export const resolveAssignableClaimedDiscordUpdate = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.taskId)
    if (task === null) return null
    const assigneeIds = concreteAssigneeIds(task.assigneeIds)
    if (assigneeIds.length === 0) return null

    const [assignee, { name }] = await Promise.all([
      ctx.db.get("users", assigneeIds[0]),
      loadTaskRootDocs(ctx, task),
    ])
    const draft = await enrichTaskNotificationDraft(
      ctx,
      taskDraftShell({
        task,
        rootName: name,
        actor: assignee,
        target: { kind: "user", userId: assigneeIds[0] },
        fallbackText: `Claimed: ${task.name}`,
        url: taskUrl(task._id),
        color: EMBED_COLOR.success,
        fields: [
          embedField(
            ":white_check_mark:",
            "Claimed",
            `**${userDisplayName(assignee)}** claimed this task.`
          ),
        ],
      }),
      task._id
    )
    const embed = draft.embeds[0]
    const view = draft.buttons.find((button) => button.kind === "url")
    if (view?.kind !== "url") return null
    return {
      embeds: [
        {
          title: embed.title,
          description: embed.description,
          url: embed.url,
          color: embed.color,
          fields: embed.fields,
          author:
            embed.author === undefined
              ? undefined
              : { name: embed.author.name, icon_url: embed.author.iconUrl },
          footer: {
            text: "SI Headquarters",
            icon_url: "https://hq.speedcubingireland.com/favicon.png",
          },
          timestamp: new Date().toISOString(),
        },
      ],
      components: [
        {
          type: 1,
          components: [{ type: 2, style: 5, label: view.label, url: view.url }],
        },
      ],
      allowed_mentions: { parse: [] },
    }
  },
})
