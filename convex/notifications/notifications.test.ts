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
  insertCompetitionPhase,
  insertSeedTask,
} from "@/convex/testHelpers"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import { ensureTeamByName } from "@/convex/teams/model"
import { resetTaskDueNoticeState } from "@/convex/notifications/events"
import { NUDGE_COOLDOWN_MS } from "@/convex/notifications/nudge"
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

  test("task reminders include snooze actions and a custom-time HQ link", async () => {
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
      return { taskId }
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "taskOverdue",
          taskId,
          dueDate: "2026-06-07",
          today: "2026-06-08",
        },
      }
    )

    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.embeds[0]?.author?.name).toBe("SI Headquarters")
    expect(drafts[0]?.embeds[0]?.fields?.[0]?.value).toContain(
      "**1 day ago** (2026-06-07)"
    )
  })
})

describe("due notifications", () => {
  test("due-soon means tomorrow in Dublin and overdue remains deduped", async () => {
    const t = convexTest(schema, modules)
    const nowMs = Date.UTC(2026, 5, 8, 7, 0, 0)
    const { tomorrowTaskId, todayTaskId, overdueTaskId } = await t.run(
      async (ctx) => {
        const { taskId: tomorrowTaskId } = await seedTaskInCompetition(ctx)
        const { taskId: todayTaskId } = await seedTaskInCompetition(ctx)
        const { taskId: overdueTaskId } = await seedTaskInCompetition(ctx)
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
        return { tomorrowTaskId, todayTaskId, overdueTaskId }
      }
    )

    await t.mutation(internal.notifications.due.runDueScan, { nowMs })
    await t.mutation(internal.notifications.due.runDueScan, { nowMs })

    const states = await t.run(async (ctx) =>
      ctx.db.query("taskDueNoticeStates").collect()
    )

    expect(states).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: tomorrowTaskId,
          dueDate: "2026-06-09",
          kind: "due-soon",
        }),
        expect.objectContaining({
          taskId: overdueTaskId,
          dueDate: "2026-06-07",
          kind: "overdue",
        }),
      ])
    )
    expect(
      states.some(
        (state) => state.taskId === todayTaskId && state.kind === "due-soon"
      )
    ).toBe(false)
    expect(states).toHaveLength(2)
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
    const task = await t.run(async (ctx) => ctx.db.get("tasks", taskId))
    expect(task?.assigneeIds).not.toBe("assignable")
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
      await ctx.db.insert("competitionLinkedResources", {
        competitionId,
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
})

describe("due notice reset", () => {
  test("due date edits clear prior dedupe rows for the task", async () => {
    const t = convexTest(schema, modules)
    const taskId = await t.run(async (ctx) => {
      const { taskId } = await seedTaskInCompetition(ctx)
      await ctx.db.insert("taskDueNoticeStates", {
        taskId,
        dueDate: "2026-06-07",
        kind: "overdue",
        sentAt: Date.now(),
      })
      await ctx.db.insert("taskDueNoticeStates", {
        taskId,
        dueDate: "2026-06-09",
        kind: "due-soon",
        sentAt: Date.now(),
      })
      await resetTaskDueNoticeState(ctx, taskId)
      return taskId
    })

    const states = await t.run(async (ctx) =>
      ctx.db
        .query("taskDueNoticeStates")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
        .collect()
    )
    expect(states).toHaveLength(0)
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
          kind: "competitionPhaseChanged",
          competitionId,
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
