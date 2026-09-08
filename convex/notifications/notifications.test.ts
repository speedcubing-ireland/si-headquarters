/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import {
  decodeNotificationAction,
  encodeNotificationAction,
  DISCORD_CUSTOM_ID_LIMIT,
} from "@/convex/notifications/actionCodec"
import schema from "@/convex/schema"
import { api } from "@/convex/_generated/api"
import {
  ensureVolunteerMembership,
  insertBlankCompetition,
  insertBlankProject,
  insertCompetitionPhase,
  insertProjectPhase,
  insertSeedTask,
} from "@/convex/testHelpers"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import { addTeamMember, ensureTeamByName } from "@/convex/teams/model"
import { NUDGE_COOLDOWN_MS } from "@/convex/notifications/nudge"
import type { NotificationEvent } from "@/convex/notifications/validators"
import { modules } from "@/convex/test.setup"

async function insertLinkedUser(
  ctx: MutationCtx,
  name: string,
  discordUserId: string
) {
  const userId = await ctx.db.insert("users", {
    name,
    discordUserId,
    discordUsername: name.toLowerCase().replaceAll(" ", "_"),
    discordDisplayName: name,
    discordLinkedAt: Date.now(),
  })
  await ensureVolunteerMembership(ctx, userId)
  return userId
}

async function seedTaskInCompetition(ctx: MutationCtx) {
  const competitionId = await insertBlankCompetition(ctx)
  const phaseId = await insertCompetitionPhase(
    ctx,
    competitionId,
    "Planning",
    "a"
  )
  const taskId = await insertSeedTask(ctx, {
    name: "Arrange delegates",
    parent: { type: "phases", id: phaseId },
    order: "a",
    status: "to-do",
  })
  return { competitionId, phaseId, taskId }
}

async function getScheduledNotificationEvents(
  t: ReturnType<typeof convexTest>
): Promise<NotificationEvent[]> {
  return t.run(async (ctx) => {
    const scheduled = await ctx.db.system
      .query("_scheduled_functions")
      .collect()
    return scheduled
      .filter((entry) => entry.name.includes("dispatchEvent"))
      .map((entry) => (entry.args as [{ event: NotificationEvent }])[0].event)
  })
}

async function runDueScanToCompletion(
  t: ReturnType<typeof convexTest>,
  nowMs: number
) {
  await t.mutation(internal.notifications.due.runDueScan, { nowMs })

  const executedJobIds = new Set<string>()
  for (let iteration = 0; iteration < 500; iteration++) {
    const job = await t.run(async (ctx) => {
      const scheduled = await ctx.db.system
        .query("_scheduled_functions")
        .collect()
      return (
        scheduled.find(
          (entry) =>
            entry.name.includes("due:_") && !executedJobIds.has(entry._id)
        ) ?? null
      )
    })
    if (job === null) return

    executedJobIds.add(job._id)
    const args = (job.args as [object])[0]
    if (job.name.includes("_continueDueSoonScan")) {
      await t.mutation(
        internal.notifications.due._continueDueSoonScan,
        args as never
      )
      continue
    }
    if (job.name.includes("_selectOverdueOwner")) {
      await t.mutation(
        internal.notifications.due._selectOverdueOwner,
        args as never
      )
      continue
    }
    if (job.name.includes("_scanOverdueOwnerTasks")) {
      await t.mutation(
        internal.notifications.due._scanOverdueOwnerTasks,
        args as never
      )
      continue
    }
    throw new Error(`Unexpected due scan scheduled job: ${job.name}`)
  }

  throw new Error("due scan did not finish scheduled work")
}

describe("notification action codec", () => {
  test("encodes compact signed payloads with expiry", async () => {
    const action = {
      kind: "claimTask" as const,
      taskId: "m17a3p32m707k603axs765veh587yntt" as Id<"tasks">,
    }
    const customId = await encodeNotificationAction(
      action,
      "test-secret",
      "production",
      1_800_000_000_000
    )

    expect(customId.length).toBeLessThanOrEqual(DISCORD_CUSTOM_ID_LIMIT)
    expect(customId).toMatch(/^n2\.pc\./)
    await expect(
      decodeNotificationAction(customId, "wrong-secret", 1_800_000_000_000)
    ).resolves.toEqual({
      ok: false,
      reason: "signature",
      deploymentContext: "production",
    })
    await expect(
      decodeNotificationAction(customId, "test-secret", 1_800_000_000_000)
    ).resolves.toEqual({ ok: true, action, deploymentContext: "production" })
    await expect(
      decodeNotificationAction(customId, "test-secret", 1_800_604_801_000)
    ).resolves.toEqual({
      ok: false,
      reason: "expired",
      deploymentContext: "production",
    })
  })

  test("rejects unsupported or malformed custom IDs without throwing", async () => {
    const legacyCustomId =
      "n1.WyJjIiwibTE3YTNwMzJtNzA3azYwM2F4czc2NXZlaDU4N3ludHQiLCJ0Z2Fob2UiLCJ0Z25nY2UiXQ.4e89M4XU9xfUYD0X"

    await expect(
      decodeNotificationAction(legacyCustomId, "test-secret")
    ).resolves.toEqual({ ok: false, reason: "format" })
    await expect(
      decodeNotificationAction("n2.pc.target.tgai2y.tgngqy.!@#", "test-secret")
    ).resolves.toEqual({
      ok: false,
      reason: "signature",
      deploymentContext: "production",
    })
    await expect(
      decodeNotificationAction("n2.xc.target.tgai2y.tgngqy.sig", "test-secret")
    ).resolves.toEqual({ ok: false, reason: "format" })
  })
})

describe("notification drafts", () => {
  test("suppresses actor DMs and skips unlinked users", async () => {
    const t = convexTest(schema, modules)
    const { taskId, actorId, assigneeId } = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const actorId = await insertLinkedUser(ctx, "Actor", "discord-actor")
      const assigneeId = await insertLinkedUser(
        ctx,
        "Assignee",
        "discord-assignee"
      )
      const unlinkedId = await ctx.db.insert("users", { name: "Unlinked" })
      await ctx.db.insert("subscriptions", {
        userId: unlinkedId,
        object: { type: "tasks", id: taskId },
      })
      return { taskId, actorId, assigneeId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "taskAssigned",
          taskId,
          actorId,
          previousAssigneeIds: null,
          nextAssigneeIds: [actorId, assigneeId],
        },
      }
    )

    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.target).toEqual({
      kind: "discordUser",
      discordUserId: "discord-assignee",
    })
    expect(drafts[0]?.embeds[0]?.title).toBe("Task Assigned: Arrange delegates")
    expect(drafts[0]?.embeds[0]?.description).toContain("Arrange delegates")
    expect(drafts[0]?.embeds[0]?.fields?.[0]?.name).toContain("Assigned by")
  })

  test("does not suppress actor DMs for side-effect notifications", async () => {
    const t = convexTest(schema, modules)
    const { taskId, actorId } = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const actorId = await insertLinkedUser(ctx, "Actor", "discord-actor")
      await ctx.db.patch("tasks", taskId, { assigneeIds: [actorId] })
      return { taskId, actorId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "taskUnblocked",
          taskId,
          actorId,
        },
      }
    )

    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.target).toEqual({
      kind: "discordUser",
      discordUserId: "discord-actor",
    })
  })

  test("task reminders include snooze actions and a custom-time product link", async () => {
    const t = convexTest(schema, modules)
    const { reminderId } = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const userId = await insertLinkedUser(
        ctx,
        "Reminder Owner",
        "discord-owner"
      )
      const reminderId = await ctx.db.insert("taskReminders", {
        taskId,
        userId,
        remindAt: Date.UTC(2026, 5, 9, 7),
        message: "Check the venue booking.",
        scheduledFunctionId: null,
        sentAt: null,
        cancelledAt: null,
        failedAt: null,
        lastError: null,
      })
      return { reminderId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "taskReminder",
          reminderId,
        },
      }
    )

    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.buttons.map((button) => button.label)).toEqual([
      "View",
      "Snooze 1h",
      "Tomorrow",
      "Custom time",
      "Start",
    ])
    expect(drafts[0]?.buttons.map((button) => button.row ?? 0)).toEqual([
      1, 0, 0, 0, 1,
    ])
    expect(drafts[0]?.embeds[0]?.fields?.[0]?.value).toBe(
      "Check the venue booking."
    )
  })

  test("overdue task drafts show relative lateness", async () => {
    const t = convexTest(schema, modules)
    const { taskId } = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const assigneeId = await insertLinkedUser(
        ctx,
        "Assignee",
        "discord-assignee"
      )
      await ctx.db.patch("tasks", taskId, {
        assigneeIds: [assigneeId],
        dueDate: "2026-06-07",
      })
      return { taskId, assigneeId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "taskOverdue",
          taskId,
          today: "2026-06-08",
        },
      }
    )

    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.target).toEqual({
      kind: "discordUser",
      discordUserId: "discord-assignee",
    })
    expect(drafts[0]?.embeds[0]?.fields?.[0]?.value).toContain(
      "**1 day ago** (2026-06-07)"
    )
  })

  test("overdue task drafts fan out to assignees and subscribers", async () => {
    const t = convexTest(schema, modules)
    const { taskId } = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const assigneeId = await insertLinkedUser(
        ctx,
        "Assignee",
        "discord-assignee"
      )
      const subscriberId = await insertLinkedUser(
        ctx,
        "Subscriber",
        "discord-subscriber"
      )
      await ctx.db.insert("subscriptions", {
        userId: subscriberId,
        object: { type: "tasks", id: taskId },
      })
      await ctx.db.patch("tasks", taskId, {
        assigneeIds: [assigneeId],
        dueDate: "2026-06-07",
      })
      return { taskId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "taskOverdue",
          taskId,
          today: "2026-06-08",
        },
      }
    )

    expect(drafts.map((draft) => draft.target)).toEqual([
      { kind: "discordUser", discordUserId: "discord-assignee" },
      { kind: "discordUser", discordUserId: "discord-subscriber" },
    ])
  })

  test("owner overdue summary posts one channel message", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, taskId } = await t.run(async (ctx) => {
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Planning",
        "a"
      )
      await ctx.db.patch("competitions", competitionId, { phaseId })
      const taskId = await insertSeedTask(ctx, {
        name: "Late task",
        parent: { type: "phases", id: phaseId },
        order: "a",
        status: "to-do",
      })
      await ctx.db.patch("tasks", taskId, { dueDate: "2026-06-07" })
      await ctx.db.insert("objectLinkedResources", {
        object: { type: "competitions", id: competitionId },
        resourceType: "discordChannel",
        resourceKey: "default",
        data: {
          resourceType: "discordChannel",
          channelId: "comp-channel-summary",
          channelName: "spring-open",
          guildId: "guild-1",
        },
      })
      return { competitionId, taskId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "ownerOverdueSummary",
          owner: { type: "competitions", id: competitionId },
          today: "2026-06-08",
          taskIds: [taskId],
          totalCount: 1,
        },
      }
    )

    expect(drafts.map((draft) => draft.target)).toEqual([
      { kind: "discordChannel", channelId: "comp-channel-summary" },
    ])
    expect(drafts[0]?.embeds[0]?.fields?.[0]?.name).toContain("Overdue Tasks")
    expect(drafts[0]?.embeds[0]?.fields?.[0]?.value).toContain("Late task")
  })

  test("project update drafts route to lead, members, team members, and subscribers", async () => {
    const t = convexTest(schema, modules)
    const { projectId, updateId, actorId } = await t.run(async (ctx) => {
      const projectId = await insertBlankProject(ctx)
      const actorId = await insertLinkedUser(ctx, "Lead Actor", "discord-lead")
      const memberId = await insertLinkedUser(ctx, "Member", "discord-member")
      const teamMemberId = await insertLinkedUser(
        ctx,
        "Team Member",
        "discord-team-member"
      )
      const subscriberId = await insertLinkedUser(
        ctx,
        "Subscriber",
        "discord-subscriber"
      )
      const unlinkedId = await ctx.db.insert("users", { name: "Unlinked" })
      const teamId = await ensureTeamByName(ctx, TEAM_NAMES.SOFTWARE)
      await addTeamMember(ctx, teamId, teamMemberId)
      await ctx.db.patch("projects", projectId, { leadUserId: actorId })
      await ctx.db.insert("projectMembers", {
        projectId,
        member: { type: "users", id: memberId },
      })
      await ctx.db.insert("projectMembers", {
        projectId,
        member: { type: "users", id: unlinkedId },
      })
      await ctx.db.insert("projectMembers", {
        projectId,
        member: { type: "teams", id: teamId },
      })
      await ctx.db.insert("subscriptions", {
        userId: subscriberId,
        object: { type: "projects", id: projectId },
      })
      await ctx.db.insert("objectLinkedResources", {
        object: { type: "projects", id: projectId },
        resourceType: "discordChannel",
        resourceKey: "default",
        data: {
          resourceType: "discordChannel",
          guildId: "guild-1",
          channelId: "project-channel-1",
          channelName: "sample-project",
        },
      })
      const updateId = await ctx.db.insert("objectUpdates", {
        object: { type: "projects", id: projectId },
        authorId: actorId,
        body: "The venue booking automation is ready for review.",
        editedAt: Date.now(),
      })
      return { projectId, updateId, actorId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "updatePublished",
          object: { type: "projects", id: projectId },
          updateId,
          actorId,
        },
      }
    )

    expect(drafts.map((draft) => draft.target)).toEqual(
      expect.arrayContaining([
        { kind: "discordChannel", channelId: "project-channel-1" },
        { kind: "discordUser", discordUserId: "discord-member" },
        { kind: "discordUser", discordUserId: "discord-team-member" },
        { kind: "discordUser", discordUserId: "discord-subscriber" },
      ])
    )
    expect(drafts).toHaveLength(4)
    expect(drafts[0]?.embeds[0]?.title).toBe("Project Update: Sample Project")
    expect(drafts[0]?.embeds[0]?.fields?.[0]?.value).toContain(
      "venue booking automation"
    )
  })
})

describe("due notifications", () => {
  test("due scan accepts delayed local-morning starts and claims the date once", async () => {
    const t = convexTest(schema, modules)
    const delayedNowMs = Date.UTC(2026, 5, 8, 8, 30, 0)

    await t.mutation(internal.notifications.due.runDueScan, {
      nowMs: delayedNowMs,
    })
    const scheduledAfterFirst = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )

    await t.mutation(internal.notifications.due.runDueScan, {
      nowMs: delayedNowMs + 15 * 60 * 1000,
    })
    const scheduledAfterSecond = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )

    expect(
      scheduledAfterFirst.filter((entry) =>
        entry.name.includes("due:_selectOverdueOwner")
      )
    ).toHaveLength(1)
    expect(scheduledAfterSecond).toHaveLength(scheduledAfterFirst.length)
  })

  test("due scan skips invocations before the local-morning window", async () => {
    const t = convexTest(schema, modules)

    await t.mutation(internal.notifications.due.runDueScan, {
      nowMs: Date.UTC(2026, 5, 8, 6, 59, 0),
    })

    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )
    expect(scheduled).toEqual([])
  })

  test("due scan schedules tomorrow due-soon and overdue watcher events", async () => {
    const t = convexTest(schema, modules)
    const nowMs = Date.UTC(2026, 5, 8, 7, 0, 0)
    const { tomorrowTaskId, todayTaskId, overdueTaskId, competitionId } =
      await t.run(async (ctx) => {
        const { competitionId, phaseId } = await seedTaskInCompetition(ctx)
        const tomorrowTaskId = await insertSeedTask(ctx, {
          name: "Tomorrow task",
          parent: { type: "phases", id: phaseId },
          order: "b",
          status: "to-do",
        })
        const todayTaskId = await insertSeedTask(ctx, {
          name: "Today task",
          parent: { type: "phases", id: phaseId },
          order: "c",
          status: "to-do",
        })
        const overdueTaskId = await insertSeedTask(ctx, {
          name: "Overdue task",
          parent: { type: "phases", id: phaseId },
          order: "d",
          status: "to-do",
        })
        const assigneeId = await insertLinkedUser(
          ctx,
          "Assignee",
          "discord-user"
        )
        await Promise.all([
          ctx.db.patch("tasks", tomorrowTaskId, {
            assigneeIds: [assigneeId],
            dueDate: "2026-06-09",
          }),
          ctx.db.patch("tasks", todayTaskId, {
            assigneeIds: [assigneeId],
            dueDate: "2026-06-08",
          }),
          ctx.db.patch("tasks", overdueTaskId, {
            assigneeIds: [assigneeId],
            dueDate: "2026-06-07",
          }),
        ])
        return {
          tomorrowTaskId,
          todayTaskId,
          overdueTaskId,
          competitionId,
        }
      })

    await runDueScanToCompletion(t, nowMs)

    const events = await getScheduledNotificationEvents(t)

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "taskDueSoon",
          taskId: tomorrowTaskId,
          dueDate: "2026-06-09",
        }),
        expect.objectContaining({
          kind: "taskOverdue",
          taskId: overdueTaskId,
          today: "2026-06-08",
        }),
        expect.objectContaining({
          kind: "ownerOverdueSummary",
          owner: { type: "competitions", id: competitionId },
          today: "2026-06-08",
        }),
      ])
    )
    expect(
      events.some(
        (event) => event.kind === "taskDueSoon" && event.taskId === todayTaskId
      )
    ).toBe(false)
  })

  test("due scan skips competitions the WCA has cancelled", async () => {
    const t = convexTest(schema, modules)
    const nowMs = Date.UTC(2026, 5, 8, 7, 0, 0)
    const { overdueTaskId, competitionId } = await t.run(async (ctx) => {
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Planning",
        "a"
      )
      await ctx.db.patch("competitions", competitionId, {
        phaseId,
        // A cancelled competition is not live work, so its overdue tasks must
        // not keep nagging.
        cancelledAt: nowMs,
      })
      const overdueTaskId = await insertSeedTask(ctx, {
        name: "Overdue task",
        parent: { type: "phases", id: phaseId },
        order: "a",
        status: "to-do",
      })
      const assigneeId = await insertLinkedUser(ctx, "Assignee", "discord-user")
      await ctx.db.patch("tasks", overdueTaskId, {
        assigneeIds: [assigneeId],
        dueDate: "2026-06-07",
      })
      return { overdueTaskId, competitionId }
    })

    await runDueScanToCompletion(t, nowMs)

    const events = await getScheduledNotificationEvents(t)
    expect(
      events.some(
        (event) =>
          event.kind === "taskOverdue" && event.taskId === overdueTaskId
      )
    ).toBe(false)
    expect(
      events.some(
        (event) =>
          event.kind === "ownerOverdueSummary" &&
          event.owner.id === competitionId
      )
    ).toBe(false)
  })

  test("due scan notifies for phase carryover-only tasks", async () => {
    const t = convexTest(schema, modules)
    const nowMs = Date.UTC(2026, 5, 8, 7, 0, 0)
    const { carryoverTaskId, competitionId } = await t.run(async (ctx) => {
      const competitionId = await insertBlankCompetition(ctx)
      const planningPhaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Planning",
        "a"
      )
      const executionPhaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Execution",
        "b"
      )
      await ctx.db.patch("competitions", competitionId, {
        phaseId: executionPhaseId,
      })
      const carryoverTaskId = await insertSeedTask(ctx, {
        name: "Carryover task",
        parent: { type: "phases", id: planningPhaseId },
        order: "a",
        status: "to-do",
      })
      const assigneeId = await insertLinkedUser(
        ctx,
        "Assignee",
        "discord-carryover"
      )
      await ctx.db.patch("tasks", carryoverTaskId, {
        assigneeIds: [assigneeId],
      })
      return { carryoverTaskId, competitionId }
    })

    await runDueScanToCompletion(t, nowMs)
    const events = await getScheduledNotificationEvents(t)

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "taskOverdue",
          taskId: carryoverTaskId,
          today: "2026-06-08",
        }),
        expect.objectContaining({
          kind: "ownerOverdueSummary",
          owner: { type: "competitions", id: competitionId },
          today: "2026-06-08",
          taskIds: [carryoverTaskId],
          totalCount: 1,
        }),
      ])
    )
  })

  test("due scan does not treat nested subtasks as phase carryover", async () => {
    const t = convexTest(schema, modules)
    const nowMs = Date.UTC(2026, 5, 8, 7, 0, 0)
    const { carryoverTaskId, nestedTaskId, competitionId } = await t.run(
      async (ctx) => {
        const competitionId = await insertBlankCompetition(ctx)
        const planningPhaseId = await insertCompetitionPhase(
          ctx,
          competitionId,
          "Planning",
          "a"
        )
        const executionPhaseId = await insertCompetitionPhase(
          ctx,
          competitionId,
          "Execution",
          "b"
        )
        await ctx.db.patch("competitions", competitionId, {
          phaseId: executionPhaseId,
        })
        const carryoverTaskId = await insertSeedTask(ctx, {
          name: "Carryover task",
          parent: { type: "phases", id: planningPhaseId },
          order: "a",
          status: "to-do",
        })
        const nestedTaskId = await insertSeedTask(ctx, {
          name: "Nested task",
          parent: { type: "tasks", id: carryoverTaskId },
          order: "a",
          status: "to-do",
        })
        return { carryoverTaskId, nestedTaskId, competitionId }
      }
    )

    await runDueScanToCompletion(t, nowMs)
    const events = await getScheduledNotificationEvents(t)
    const taskOverdueEvents = events.filter(
      (event) => event.kind === "taskOverdue"
    )
    const ownerSummaryEvents = events.filter(
      (
        event
      ): event is Extract<NotificationEvent, { kind: "ownerOverdueSummary" }> =>
        event.kind === "ownerOverdueSummary" &&
        event.owner.type === "competitions" &&
        event.owner.id === competitionId
    )

    expect(taskOverdueEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: carryoverTaskId,
          today: "2026-06-08",
        }),
      ])
    )
    expect(
      taskOverdueEvents.some((event) => event.taskId === nestedTaskId)
    ).toBe(false)
    expect(ownerSummaryEvents).toHaveLength(1)
    expect(ownerSummaryEvents[0].taskIds).toEqual([carryoverTaskId])
    expect(ownerSummaryEvents[0].totalCount).toBe(1)
  })

  test("task both date-overdue and carryover notifies once", async () => {
    const t = convexTest(schema, modules)
    const nowMs = Date.UTC(2026, 5, 8, 7, 0, 0)
    const { dedupedTaskId, competitionId } = await t.run(async (ctx) => {
      const competitionId = await insertBlankCompetition(ctx)
      const planningPhaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Planning",
        "a"
      )
      const executionPhaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Execution",
        "b"
      )
      await ctx.db.patch("competitions", competitionId, {
        phaseId: executionPhaseId,
      })
      const dedupedTaskId = await insertSeedTask(ctx, {
        name: "Double overdue task",
        parent: { type: "phases", id: planningPhaseId },
        order: "a",
        status: "to-do",
      })
      const assigneeId = await insertLinkedUser(
        ctx,
        "Assignee",
        "discord-deduped"
      )
      await ctx.db.patch("tasks", dedupedTaskId, {
        assigneeIds: [assigneeId],
        dueDate: "2026-06-07",
      })
      return { dedupedTaskId, competitionId }
    })

    await runDueScanToCompletion(t, nowMs)
    const events = await getScheduledNotificationEvents(t)

    const taskOverdueEvents = events.filter(
      (event) => event.kind === "taskOverdue" && event.taskId === dedupedTaskId
    )
    const ownerSummaryEvents = events.filter(
      (
        event
      ): event is Extract<NotificationEvent, { kind: "ownerOverdueSummary" }> =>
        event.kind === "ownerOverdueSummary" &&
        event.owner.type === "competitions" &&
        event.owner.id === competitionId
    )

    expect(taskOverdueEvents).toHaveLength(1)
    expect(ownerSummaryEvents).toHaveLength(1)
    expect(ownerSummaryEvents[0].taskIds).toEqual([dedupedTaskId])
  })

  test("due scan skips done, cancelled, and due-today tasks", async () => {
    const t = convexTest(schema, modules)
    const nowMs = Date.UTC(2026, 5, 8, 7, 0, 0)
    const { doneTaskId, cancelledTaskId, todayTaskId } = await t.run(
      async (ctx) => {
        const { phaseId } = await seedTaskInCompetition(ctx)
        const assigneeId = await insertLinkedUser(
          ctx,
          "Assignee",
          "discord-skipped"
        )
        const doneTaskId = await insertSeedTask(ctx, {
          name: "Done overdue",
          parent: { type: "phases", id: phaseId },
          order: "b",
          status: "done",
        })
        const cancelledTaskId = await insertSeedTask(ctx, {
          name: "Cancelled overdue",
          parent: { type: "phases", id: phaseId },
          order: "c",
          status: "cancelled",
        })
        const todayTaskId = await insertSeedTask(ctx, {
          name: "Due today",
          parent: { type: "phases", id: phaseId },
          order: "d",
          status: "to-do",
        })
        await Promise.all([
          ctx.db.patch("tasks", doneTaskId, {
            assigneeIds: [assigneeId],
            dueDate: "2026-06-07",
          }),
          ctx.db.patch("tasks", cancelledTaskId, {
            assigneeIds: [assigneeId],
            dueDate: "2026-06-07",
          }),
          ctx.db.patch("tasks", todayTaskId, {
            assigneeIds: [assigneeId],
            dueDate: "2026-06-08",
          }),
        ])
        return { doneTaskId, cancelledTaskId, todayTaskId }
      }
    )

    await runDueScanToCompletion(t, nowMs)
    const events = await getScheduledNotificationEvents(t)

    for (const taskId of [doneTaskId, cancelledTaskId, todayTaskId]) {
      expect(
        events.some(
          (event) =>
            (event.kind === "taskDueSoon" || event.kind === "taskOverdue") &&
            event.taskId === taskId
        )
      ).toBe(false)
    }
  })

  test("due scan dispatches every overdue notification exactly once at volume", async () => {
    const t = convexTest(schema, modules)
    const nowMs = Date.UTC(2026, 5, 8, 7, 0, 0)
    const { competitionIds, taskIds } = await t.run(async (ctx) => {
      const assigneeId = await insertLinkedUser(
        ctx,
        "Assignee",
        "discord-volume"
      )
      const competitionIds: Id<"competitions">[] = []
      const taskIds: Id<"tasks">[] = []

      for (let competitionIndex = 0; competitionIndex < 3; competitionIndex++) {
        const competitionId = await insertBlankCompetition(ctx)
        competitionIds.push(competitionId)
        const phaseId = await insertCompetitionPhase(
          ctx,
          competitionId,
          "Planning",
          "a"
        )
        for (let taskIndex = 0; taskIndex < 40; taskIndex++) {
          const taskId = await insertSeedTask(ctx, {
            name: `Overdue ${String(competitionIndex)}-${String(taskIndex)}`,
            parent: { type: "phases", id: phaseId },
            order: `t${String(taskIndex).padStart(3, "0")}`,
            status: "to-do",
          })
          await ctx.db.patch("tasks", taskId, {
            assigneeIds: [assigneeId],
            dueDate: "2026-06-07",
          })
          taskIds.push(taskId)
        }
      }

      return { competitionIds, taskIds }
    })

    await runDueScanToCompletion(t, nowMs)
    const events = await getScheduledNotificationEvents(t)

    const taskOverdueEvents = events.filter(
      (event) => event.kind === "taskOverdue"
    )
    const ownerSummaryEvents = events.filter(
      (event) => event.kind === "ownerOverdueSummary"
    )

    expect(taskOverdueEvents).toHaveLength(120)
    expect(ownerSummaryEvents).toHaveLength(3)
    for (const event of ownerSummaryEvents) {
      expect(event.taskIds).toHaveLength(5)
      expect(event.totalCount).toBe(40)
    }
    for (const taskId of taskIds) {
      expect(
        taskOverdueEvents.filter((event) => event.taskId === taskId)
      ).toHaveLength(1)
    }
    for (const competitionId of competitionIds) {
      expect(
        ownerSummaryEvents.filter(
          (event) =>
            event.owner.type === "competitions" &&
            event.owner.id === competitionId
        )
      ).toHaveLength(1)
    }
  })

  test("user-owned date-overdue task notifies watchers", async () => {
    const t = convexTest(schema, modules)
    const nowMs = Date.UTC(2026, 5, 8, 7, 0, 0)
    const { overdueTaskId } = await t.run(async (ctx) => {
      const projectId = await insertBlankProject(ctx)
      const phaseId = await insertProjectPhase(ctx, projectId, "Planning", "a")
      const overdueTaskId = await insertSeedTask(ctx, {
        name: "User-owned overdue",
        parent: { type: "phases", id: phaseId },
        order: "a",
        status: "to-do",
      })
      const assigneeId = await insertLinkedUser(
        ctx,
        "Assignee",
        "discord-user-owned"
      )
      await ctx.db.patch("tasks", overdueTaskId, {
        assigneeIds: [assigneeId],
        dueDate: "2026-06-07",
        owner: { type: "users", id: assigneeId },
      })
      return { overdueTaskId }
    })

    await runDueScanToCompletion(t, nowMs)
    const events = await getScheduledNotificationEvents(t)

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "taskOverdue",
          taskId: overdueTaskId,
        }),
      ])
    )
    expect(
      events.some(
        (event) =>
          event.kind === "ownerOverdueSummary" &&
          event.owner.type === "projects"
      )
    ).toBe(true)
  })
})

describe("Discord notification actions", () => {
  test("claim validates current task state before assigning", async () => {
    const t = convexTest(schema, modules)
    const { taskId } = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const userId = await insertLinkedUser(ctx, "Claimer", "discord-claimer")
      await ctx.db.patch("tasks", taskId, {
        assigneeIds: "assignable",
        status: "backlog",
        statusIntent: { type: "manual", status: "backlog" },
        owner: { type: "users", id: userId },
      })
      return { taskId }
    })

    const staleResult = await t.mutation(
      internal.notifications.actions.executeDiscordAction,
      {
        discordUserId: "discord-claimer",
        action: { kind: "claimTask", taskId },
      }
    )
    expect(staleResult.content).toMatch(/cannot be claimed/)
    expect(staleResult.updateMessage).toBeUndefined()

    await t.run(async (ctx) => {
      await ctx.db.patch("tasks", taskId, {
        status: "to-do",
        statusIntent: { type: "manual", status: "to-do" },
      })
    })
    const claimedResult = await t.mutation(
      internal.notifications.actions.executeDiscordAction,
      {
        discordUserId: "discord-claimer",
        action: { kind: "claimTask", taskId },
      }
    )

    expect(claimedResult.content).toBe("Task claimed.")
    expect(claimedResult.updateMessage).toBe(taskId)

    const alreadyClaimed = await t.mutation(
      internal.notifications.actions.executeDiscordAction,
      {
        discordUserId: "discord-claimer",
        action: { kind: "claimTask", taskId },
      }
    )
    expect(alreadyClaimed.content).toMatch(/already claimed/)
    expect(alreadyClaimed.updateMessage).toBe(taskId)
  })
})

describe("task assignee notifications", () => {
  test("manual task subscribers receive assignee update DMs", async () => {
    const t = convexTest(schema, modules)
    const { taskId, actorId, assigneeId } = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const actorId = await insertLinkedUser(ctx, "Actor", "discord-actor")
      const assigneeId = await insertLinkedUser(
        ctx,
        "Assignee",
        "discord-assignee"
      )
      const subscriberId = await insertLinkedUser(
        ctx,
        "Watcher",
        "discord-watcher"
      )
      await ctx.db.insert("subscriptions", {
        userId: subscriberId,
        object: { type: "tasks", id: taskId },
      })
      return { taskId, subscriberId, actorId, assigneeId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "taskAssigned",
          taskId,
          actorId,
          previousAssigneeIds: null,
          nextAssigneeIds: [assigneeId],
        },
      }
    )

    expect(drafts.map((draft) => draft.target)).toEqual(
      expect.arrayContaining([
        { kind: "discordUser", discordUserId: "discord-assignee" },
        { kind: "discordUser", discordUserId: "discord-watcher" },
      ])
    )
    expect(
      drafts.some(
        (draft) =>
          draft.target.kind === "discordUser" &&
          draft.target.discordUserId === "discord-actor"
      )
    ).toBe(false)
  })

  test("replacement notifies removed and added assignees", async () => {
    const t = convexTest(schema, modules)
    const { taskId, oldAssigneeId, newAssigneeId, actorId } = await t.run(
      async (ctx) => {
        const { taskId } = await seedTaskInCompetition(ctx)
        const actorId = await insertLinkedUser(ctx, "Actor", "discord-actor")
        const oldAssigneeId = await insertLinkedUser(
          ctx,
          "Old Assignee",
          "discord-old"
        )
        const newAssigneeId = await insertLinkedUser(
          ctx,
          "New Assignee",
          "discord-new"
        )
        return { taskId, oldAssigneeId, newAssigneeId, actorId }
      }
    )

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "taskAssigned",
          taskId,
          actorId,
          previousAssigneeIds: [oldAssigneeId],
          nextAssigneeIds: [newAssigneeId],
        },
      }
    )

    expect(drafts.map((draft) => draft.target)).toEqual(
      expect.arrayContaining([
        { kind: "discordUser", discordUserId: "discord-old" },
        { kind: "discordUser", discordUserId: "discord-new" },
      ])
    )
    expect(drafts).toHaveLength(2)
  })
})

describe("assignable pickup routing", () => {
  test("team-owned assignable tasks route to linked team Discord channel", async () => {
    const t = convexTest(schema, modules)
    const { taskId, actorId } = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const actorId = await insertLinkedUser(ctx, "Actor", "discord-actor")
      const teamId = await ensureTeamByName(ctx, TEAM_NAMES.SOFTWARE)
      await ctx.db.insert("teamDiscordChannels", {
        teamId,
        guildId: "guild-1",
        channelId: "team-channel-1",
        channelName: "software",
        linkedAt: Date.now(),
        linkedBy: actorId,
      })
      await ctx.db.patch("tasks", taskId, {
        assigneeIds: "assignable",
        owner: { type: "teams", id: teamId },
      })
      return { taskId, actorId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "assignableTaskReady",
          taskId,
          actorId,
        },
      }
    )

    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.target).toEqual({
      kind: "discordChannel",
      channelId: "team-channel-1",
    })
    expect(drafts[0]?.buttons.map((button) => button.label)).toContain("Claim")
  })

  test("user-owned assignable tasks route to owner DM", async () => {
    const t = convexTest(schema, modules)
    const { taskId, actorId } = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const actorId = await insertLinkedUser(ctx, "Actor", "discord-actor")
      const ownerId = await insertLinkedUser(ctx, "Owner", "discord-owner")
      await ctx.db.patch("tasks", taskId, {
        assigneeIds: "assignable",
        owner: { type: "users", id: ownerId },
      })
      return { taskId, ownerId, actorId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "assignableTaskReady",
          taskId,
          actorId,
        },
      }
    )

    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.target).toEqual({
      kind: "discordUser",
      discordUserId: "discord-owner",
    })
  })
})

describe("status and review notifications", () => {
  test("direct status edits notify task watchers", async () => {
    const t = convexTest(schema, modules)
    const { taskId, actorId } = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const actorId = await insertLinkedUser(ctx, "Actor", "discord-actor")
      const assigneeId = await insertLinkedUser(
        ctx,
        "Assignee",
        "discord-assignee"
      )
      await ctx.db.patch("tasks", taskId, { assigneeIds: [assigneeId] })
      return { taskId, assigneeId, actorId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "taskStatusChanged",
          taskId,
          actorId,
          previousStatus: "to-do",
          nextStatus: "in-progress",
        },
      }
    )

    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.embeds[0]?.fields?.[0]?.name).toContain("Status")
  })

  test("awaiting review posts to user reviewer and competition channel", async () => {
    const t = convexTest(schema, modules)
    const { taskId, actorId } = await t.run(async (ctx) => {
      const { taskId, competitionId } = await seedTaskInCompetition(ctx)
      const actorId = await insertLinkedUser(ctx, "Actor", "discord-actor")
      const reviewerId = await insertLinkedUser(
        ctx,
        "Reviewer",
        "discord-reviewer"
      )
      await ctx.db.insert("objectLinkedResources", {
        object: { type: "competitions", id: competitionId },
        resourceType: "discordChannel",
        resourceKey: "default",
        data: {
          resourceType: "discordChannel",
          channelId: "comp-channel-1",
          channelName: "spring-open",
          guildId: "guild-1",
        },
      })
      await ctx.db.insert("taskReviewers", {
        taskId,
        reviewer: { type: "users", id: reviewerId },
        approvedAt: null,
        approvedBy: null,
      })
      const teamId = await ensureTeamByName(ctx, TEAM_NAMES.DELEGATES)
      await ctx.db.insert("taskReviewers", {
        taskId,
        reviewer: { type: "teams", id: teamId },
        approvedAt: null,
        approvedBy: null,
      })
      return { taskId, reviewerId, actorId, competitionId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "taskAwaitingReview",
          taskId,
          actorId,
        },
      }
    )

    expect(drafts.map((draft) => draft.target)).toEqual(
      expect.arrayContaining([
        { kind: "discordUser", discordUserId: "discord-reviewer" },
        { kind: "discordChannel", channelId: "comp-channel-1" },
      ])
    )
  })

  test("approval override posts to linked competition channel", async () => {
    const t = convexTest(schema, modules)
    const { taskId, actorId } = await t.run(async (ctx) => {
      const { taskId, competitionId } = await seedTaskInCompetition(ctx)
      const actorId = await insertLinkedUser(ctx, "Manager", "discord-manager")
      await ctx.db.insert("objectLinkedResources", {
        object: { type: "competitions", id: competitionId },
        resourceType: "discordChannel",
        resourceKey: "default",
        data: {
          resourceType: "discordChannel",
          channelId: "comp-channel-1",
          channelName: "spring-open",
          guildId: "guild-1",
        },
      })
      return { taskId, actorId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "taskApprovalOverridden",
          taskId,
          actorId,
        },
      }
    )

    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.target).toEqual({
      kind: "discordChannel",
      channelId: "comp-channel-1",
    })
    expect(drafts[0]?.embeds[0]?.fields?.[0]?.name).toContain("overridden")
  })

  test("approval override produces no draft when no channel is linked", async () => {
    const t = convexTest(schema, modules)
    const { taskId, actorId } = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const actorId = await insertLinkedUser(ctx, "Manager", "discord-manager")
      return { taskId, actorId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "taskApprovalOverridden",
          taskId,
          actorId,
        },
      }
    )

    expect(drafts).toHaveLength(0)
  })
})

describe("nudge", () => {
  test("getEligibility returns claimed when actor is the sole assignee", async () => {
    const t = convexTest(schema, modules)
    const { taskId, actorId } = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const actorId = await insertLinkedUser(ctx, "Claimer", "discord-claimer")
      await ctx.db.patch("tasks", taskId, { assigneeIds: [actorId] })
      return { taskId, actorId }
    })

    const eligibility = await t
      .withIdentity({ subject: actorId })
      .query(api.notifications.nudge.getEligibility, { taskId })

    expect(eligibility).toEqual({ canNudge: false, reason: "claimed" })
  })

  test("getEligibility allows nudging another assignee", async () => {
    const t = convexTest(schema, modules)
    const { taskId, actorId } = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const actorId = await insertLinkedUser(ctx, "Nudger", "discord-nudger-2")
      const assigneeId = await insertLinkedUser(
        ctx,
        "Assignee",
        "discord-assignee-2"
      )
      await ctx.db.patch("tasks", taskId, { assigneeIds: [assigneeId] })
      return { taskId, actorId }
    })

    const eligibility = await t
      .withIdentity({ subject: actorId })
      .query(api.notifications.nudge.getEligibility, { taskId })

    expect(eligibility).toEqual({
      canNudge: true,
      eligibleRecipientCount: 1,
    })
  })

  test("enforces a 24h cooldown per task and assignee", async () => {
    const t = convexTest(schema, modules)
    const { taskId, actorId, assigneeId } = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const actorId = await insertLinkedUser(ctx, "Nudger", "discord-nudger")
      const assigneeId = await insertLinkedUser(
        ctx,
        "Assignee",
        "discord-assignee"
      )
      await ctx.db.patch("tasks", taskId, {
        assigneeIds: [actorId, assigneeId],
      })
      return { taskId, actorId, assigneeId }
    })

    const client = t.withIdentity({ subject: actorId })
    await client.mutation(api.notifications.nudge.nudgeTask, { taskId })

    await expect(
      client.mutation(api.notifications.nudge.nudgeTask, { taskId })
    ).rejects.toThrow(/Nobody can be nudged/)

    await t.run(async (ctx) => {
      const cooldown = await ctx.db
        .query("taskNudgeCooldowns")
        .withIndex("by_taskId_and_assigneeId", (q) =>
          q.eq("taskId", taskId).eq("assigneeId", assigneeId)
        )
        .unique()
      if (cooldown === null) throw new Error("Expected cooldown row")
      await ctx.db.patch("taskNudgeCooldowns", cooldown._id, {
        lastNudgedAt: Date.now() - NUDGE_COOLDOWN_MS - 1,
      })
    })

    await client.mutation(api.notifications.nudge.nudgeTask, { taskId })

    const eligibility = await client.query(
      api.notifications.nudge.getEligibility,
      { taskId }
    )
    expect(eligibility).toEqual({ canNudge: false, reason: "cooldown" })
  })
})

describe("competition subscriber mirrors", () => {
  test("phase changes DM manual competition subscribers", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, previousPhaseId, nextPhaseId } = await t.run(
      async (ctx) => {
        const competitionId = await insertBlankCompetition(ctx)
        const previousPhaseId = await insertCompetitionPhase(
          ctx,
          competitionId,
          "Planning",
          "a"
        )
        const nextPhaseId = await insertCompetitionPhase(
          ctx,
          competitionId,
          "Event week",
          "b"
        )
        const subscriberId = await insertLinkedUser(
          ctx,
          "Comp Watcher",
          "discord-comp-watcher"
        )
        await ctx.db.insert("subscriptions", {
          userId: subscriberId,
          object: { type: "competitions", id: competitionId },
        })
        return {
          competitionId,
          previousPhaseId,
          nextPhaseId,
        }
      }
    )

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "phaseChanged",
          object: { type: "competitions", id: competitionId },
          actorId: null,
          previousPhaseId,
          nextPhaseId,
        },
      }
    )

    expect(
      drafts.some(
        (draft) =>
          draft.target.kind === "discordUser" &&
          draft.target.discordUserId === "discord-comp-watcher"
      )
    ).toBe(true)
  })
})

describe("reminder dispatch outcomes", () => {
  test("records failed delivery when Discord send cannot resolve a target", async () => {
    const t = convexTest(schema, modules)
    const reminderId = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      const userId = await ctx.db.insert("users", { name: "Unlinked owner" })
      return await ctx.db.insert("taskReminders", {
        taskId,
        userId,
        remindAt: Date.now(),
        message: null,
        scheduledFunctionId: null,
        sentAt: null,
        cancelledAt: null,
        failedAt: null,
        lastError: null,
      })
    })

    await t.mutation(internal.notifications.reminders.recordDispatchOutcome, {
      reminderId,
      success: false,
      errorMessage: "No linked Discord account to deliver this reminder.",
    })

    const reminder = await t.run(async (ctx) =>
      ctx.db.get("taskReminders", reminderId)
    )
    expect(reminder?.failedAt).not.toBeNull()
    expect(reminder?.sentAt).toBeNull()
    expect(reminder?.lastError).toContain("No linked Discord")
  })
})
