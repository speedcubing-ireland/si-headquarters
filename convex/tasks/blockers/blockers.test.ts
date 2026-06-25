/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import {
  deriveTaskRootContextFromParent,
  taskRootPatch,
} from "@/convex/tasks/hierarchy"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  insertBlankProject,
  insertProjectPhase,
  withVolunteerTestClient,
} from "@/convex/testHelpers"

interface TaskSeed {
  name: string
  parent: Doc<"tasks">["parent"]
  order: string
  status?: Doc<"tasks">["status"]
}

async function insertCompetition(ctx: MutationCtx) {
  return await ctx.db.insert("competitions", {
    name: "Spring Open",
    description: null,
    people: {
      compLead: null,
      leadDelegate: null,
      organisers: [],
    },
    compDates: {
      from: null,
      to: null,
    },
    phaseId: null,
  })
}

async function insertPhase(
  ctx: MutationCtx,
  competitionId: Id<"competitions">,
  name: string,
  sortKey: string
) {
  return await ctx.db.insert("phases", {
    name,
    owner: {
      type: "competitions",
      id: competitionId,
    },
    sortKey,
    color: "gray",
  })
}

async function insertTask(ctx: MutationCtx, seed: TaskSeed) {
  const status = seed.status ?? "backlog"

  return await ctx.db.insert("tasks", {
    name: seed.name,
    description: null,
    parent: seed.parent,
    ...taskRootPatch(await deriveTaskRootContextFromParent(ctx, seed.parent)),
    order: seed.order,
    assigneeIds: null,
    owner: null,
    dueDate: null,
    kind: "standard",
    status,
    statusIntent: { type: "manual", status },
  })
}

describe("task blockers", () => {
  test("addBlocker creates an edge and rejects self-block", async () => {
    const t = convexTest(schema, modules)
    const { client: actor } = await withVolunteerTestClient(t)
    const { blockedId, blockingId } = await t.run(async (ctx) => {
      const competitionId = await insertCompetition(ctx)
      const phaseId = await insertPhase(ctx, competitionId, "Setup", "a")
      const blockedId = await insertTask(ctx, {
        name: "Blocked task",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const blockingId = await insertTask(ctx, {
        name: "Blocking task",
        parent: { type: "phases", id: phaseId },
        order: "b",
      })

      return { blockedId, blockingId }
    })

    const edgeId = await actor.mutation(
      api.tasks.blockers.mutations.addBlocker,
      {
        blockedTaskId: blockedId,
        blockingTaskId: blockingId,
      }
    )

    await expect(
      actor.mutation(api.tasks.blockers.mutations.addBlocker, {
        blockedTaskId: blockedId,
        blockingTaskId: blockingId,
      })
    ).resolves.toBe(edgeId)

    await expect(
      actor.mutation(api.tasks.blockers.mutations.addBlocker, {
        blockedTaskId: blockedId,
        blockingTaskId: blockedId,
      })
    ).rejects.toThrow("A task cannot block itself")
  })

  test("removeBlocker deletes the edge", async () => {
    const t = convexTest(schema, modules)
    const { client: actor } = await withVolunteerTestClient(t)
    const { blockedId, blockingId } = await t.run(async (ctx) => {
      const competitionId = await insertCompetition(ctx)
      const phaseId = await insertPhase(ctx, competitionId, "Setup", "a")
      const blockedId = await insertTask(ctx, {
        name: "Blocked task",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const blockingId = await insertTask(ctx, {
        name: "Blocking task",
        parent: { type: "phases", id: phaseId },
        order: "b",
      })

      return { blockedId, blockingId }
    })

    const edgeId = await actor.mutation(
      api.tasks.blockers.mutations.addBlocker,
      {
        blockedTaskId: blockedId,
        blockingTaskId: blockingId,
      }
    )

    await actor.mutation(api.tasks.blockers.mutations.removeBlocker, {
      id: edgeId,
    })

    const blockers = await actor.query(api.tasks.blockers.queries.getForTask, {
      id: blockedId,
    })

    expect(blockers).toEqual({
      blockingMe: [],
      blockedByMe: [],
    })
  })

  test("getForTask returns both directions hydrated", async () => {
    const t = convexTest(schema, modules)
    const { client: actor } = await withVolunteerTestClient(t)
    const { blockedId, blockingId } = await t.run(async (ctx) => {
      const competitionId = await insertCompetition(ctx)
      const phaseId = await insertPhase(ctx, competitionId, "Setup", "a")
      const blockedId = await insertTask(ctx, {
        name: "Blocked task",
        parent: { type: "phases", id: phaseId },
        order: "a",
        status: "to-do",
      })
      const blockingId = await insertTask(ctx, {
        name: "Blocking task",
        parent: { type: "phases", id: phaseId },
        order: "b",
        status: "in-progress",
      })

      return { blockedId, blockingId }
    })

    await actor.mutation(api.tasks.blockers.mutations.addBlocker, {
      blockedTaskId: blockedId,
      blockingTaskId: blockingId,
    })

    const blockers = await actor.query(api.tasks.blockers.queries.getForTask, {
      id: blockedId,
    })

    expect(blockers.blockingMe).toHaveLength(1)
    expect(blockers.blockingMe[0]?.task).toMatchObject({
      _id: blockingId,
      name: "Blocking task",
      effectiveStatus: "in-progress",
    })

    const reverse = await actor.query(api.tasks.blockers.queries.getForTask, {
      id: blockingId,
    })

    expect(reverse.blockedByMe).toHaveLength(1)
    expect(reverse.blockedByMe[0]?.task._id).toBe(blockedId)
  })

  test("getForTask hides completed blocking tasks but keeps the edge", async () => {
    const t = convexTest(schema, modules)
    const { client: actor } = await withVolunteerTestClient(t)
    const { blockedId, blockingId } = await t.run(async (ctx) => {
      const competitionId = await insertCompetition(ctx)
      const phaseId = await insertPhase(ctx, competitionId, "Setup", "a")
      const blockedId = await insertTask(ctx, {
        name: "Blocked task",
        parent: { type: "phases", id: phaseId },
        order: "a",
        status: "to-do",
      })
      const blockingId = await insertTask(ctx, {
        name: "Blocking task",
        parent: { type: "phases", id: phaseId },
        order: "b",
        status: "in-progress",
      })

      await ctx.db.insert("taskBlockers", {
        blockedTaskId: blockedId,
        blockingTaskId: blockingId,
      })

      return { blockedId, blockingId }
    })

    const beforeDone = await actor.query(
      api.tasks.blockers.queries.getForTask,
      {
        id: blockedId,
      }
    )
    expect(beforeDone.blockingMe).toHaveLength(1)

    await t.run(async (ctx) => {
      await ctx.db.patch("tasks", blockingId, {
        status: "done",
        statusIntent: { type: "manual", status: "done" },
      })
    })

    const afterDone = await actor.query(api.tasks.blockers.queries.getForTask, {
      id: blockedId,
    })
    expect(afterDone.blockingMe).toEqual([])

    const edgeCount = await t.run(async (ctx) => {
      const edges = await ctx.db
        .query("taskBlockers")
        .withIndex("by_blockedTaskId_and_blockingTaskId", (q) =>
          q.eq("blockedTaskId", blockedId)
        )
        .collect()
      return edges.length
    })
    expect(edgeCount).toBe(1)
  })

  test("listPotentialBlockers excludes self and linked tasks", async () => {
    const t = convexTest(schema, modules)
    const { client: actor } = await withVolunteerTestClient(t)
    const { blockedId, blockingId, otherId } = await t.run(async (ctx) => {
      const competitionId = await insertCompetition(ctx)
      const phaseId = await insertPhase(ctx, competitionId, "Setup", "a")
      const blockedId = await insertTask(ctx, {
        name: "Blocked task",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const blockingId = await insertTask(ctx, {
        name: "Blocking task",
        parent: { type: "phases", id: phaseId },
        order: "b",
      })
      const otherId = await insertTask(ctx, {
        name: "Other task",
        parent: { type: "phases", id: phaseId },
        order: "c",
      })

      return { blockedId, blockingId, otherId }
    })

    await actor.mutation(api.tasks.blockers.mutations.addBlocker, {
      blockedTaskId: blockedId,
      blockingTaskId: blockingId,
    })

    const potential = await actor.query(
      api.tasks.blockers.queries.listPotentialBlockers,
      { taskId: blockedId }
    )

    expect(potential.map((task) => task._id)).toEqual([otherId])
  })

  test("subtask view rows include blocker counts that track blocker status", async () => {
    const t = convexTest(schema, modules)
    const { client: actor } = await withVolunteerTestClient(t)
    const { parentId, childId, blockingId } = await t.run(async (ctx) => {
      const competitionId = await insertCompetition(ctx)
      const phaseId = await insertPhase(ctx, competitionId, "Setup", "a")
      const parentId = await insertTask(ctx, {
        name: "Parent task",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const childId = await insertTask(ctx, {
        name: "Child task",
        parent: { type: "tasks", id: parentId },
        order: "a",
      })
      const blockingId = await insertTask(ctx, {
        name: "Blocking task",
        parent: { type: "phases", id: phaseId },
        order: "b",
        status: "in-progress",
      })

      await ctx.db.insert("taskBlockers", {
        blockedTaskId: childId,
        blockingTaskId: blockingId,
      })

      return { parentId, childId, blockingId }
    })

    const initial = await actor.query(api.tasks.queries.getSubtaskView, {
      owner: { type: "tasks", id: parentId },
    })

    const childRow = initial.sections[0]?.rows.find(
      (row) => row.task._id === childId
    )
    expect(childRow?.blockers).toEqual({
      count: 1,
      openCount: 1,
      blockingCount: 0,
      blockedBy: [{ name: "Blocking task", isOpen: true }],
    })
    expect(childRow?.dependencyStatuses).toEqual(["blocked"])

    await t.run(async (ctx) => {
      await ctx.db.patch("tasks", blockingId, {
        status: "done",
        statusIntent: { type: "manual", status: "done" },
      })
    })

    const afterDone = await actor.query(api.tasks.queries.getSubtaskView, {
      owner: { type: "tasks", id: parentId },
    })

    const updatedRow = afterDone.sections[0]?.rows.find(
      (row) => row.task._id === childId
    )
    expect(updatedRow?.blockers).toEqual({
      count: 1,
      openCount: 0,
      blockingCount: 0,
      blockedBy: [{ name: "Blocking task", isOpen: false }],
    })
    expect(updatedRow?.dependencyStatuses).toEqual(["no-dependencies"])
  })

  test("listPotentialBlockers excludes terminal-complete tasks", async () => {
    const t = convexTest(schema, modules)
    const { client: actor } = await withVolunteerTestClient(t)
    const { blockedId, openId } = await t.run(async (ctx) => {
      const competitionId = await insertCompetition(ctx)
      const phaseId = await insertPhase(ctx, competitionId, "Setup", "a")
      const blockedId = await insertTask(ctx, {
        name: "Blocked task",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      await insertTask(ctx, {
        name: "Done task",
        parent: { type: "phases", id: phaseId },
        order: "b",
        status: "done",
      })
      const openId = await insertTask(ctx, {
        name: "Open task",
        parent: { type: "phases", id: phaseId },
        order: "c",
        status: "to-do",
      })

      return { blockedId, openId }
    })

    const potential = await actor.query(
      api.tasks.blockers.queries.listPotentialBlockers,
      { taskId: blockedId }
    )

    expect(potential.map((task) => task._id)).toEqual([openId])
  })

  test("blocker counts reflect multiple blockers with mixed status", async () => {
    const t = convexTest(schema, modules)
    const { client: actor } = await withVolunteerTestClient(t)
    const { parentId, childId } = await t.run(async (ctx) => {
      const competitionId = await insertCompetition(ctx)
      const phaseId = await insertPhase(ctx, competitionId, "Setup", "a")
      const parentId = await insertTask(ctx, {
        name: "Parent task",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const childId = await insertTask(ctx, {
        name: "Child task",
        parent: { type: "tasks", id: parentId },
        order: "a",
      })
      const doneBlockerId = await insertTask(ctx, {
        name: "Done blocker",
        parent: { type: "phases", id: phaseId },
        order: "b",
        status: "done",
      })
      const openBlockerId = await insertTask(ctx, {
        name: "Open blocker",
        parent: { type: "phases", id: phaseId },
        order: "c",
        status: "in-progress",
      })

      await Promise.all([
        ctx.db.insert("taskBlockers", {
          blockedTaskId: childId,
          blockingTaskId: doneBlockerId,
        }),
        ctx.db.insert("taskBlockers", {
          blockedTaskId: childId,
          blockingTaskId: openBlockerId,
        }),
      ])

      return { parentId, childId }
    })

    const view = await actor.query(api.tasks.queries.getSubtaskView, {
      owner: { type: "tasks", id: parentId },
    })

    const childRow = view.sections[0]?.rows.find(
      (row) => row.task._id === childId
    )
    expect(childRow?.blockers).toMatchObject({ count: 2, openCount: 1 })
    expect(childRow?.blockers.blockedBy).toHaveLength(2)
  })

  test("deriveTaskRootContextFromParent copies root from task parent", async () => {
    const t = convexTest(schema, modules)

    const root = await t.run(async (ctx) => {
      const competitionId = await insertCompetition(ctx)
      const phaseId = await insertPhase(ctx, competitionId, "Setup", "a")
      const taskA = await insertTask(ctx, {
        name: "Task A",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const taskB = await insertTask(ctx, {
        name: "Task B",
        parent: { type: "tasks", id: taskA },
        order: "a",
      })

      return await deriveTaskRootContextFromParent(ctx, {
        type: "tasks",
        id: taskB,
      })
    })

    expect(root.root.type).toBe("competitions")
    expect(root.rootPhase.type).toBe("phases")
  })

  test("project tasks can block each other within the same project", async () => {
    const t = convexTest(schema, modules)
    const { client: actor } = await withVolunteerTestClient(t)
    const { blockedId, blockingId, otherId } = await t.run(async (ctx) => {
      const projectId = await insertBlankProject(ctx)
      const phaseId = await insertProjectPhase(ctx, projectId, "Setup", "a")
      const blockedId = await insertTask(ctx, {
        name: "Blocked task",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const blockingId = await insertTask(ctx, {
        name: "Blocking task",
        parent: { type: "phases", id: phaseId },
        order: "b",
      })
      const otherId = await insertTask(ctx, {
        name: "Other task",
        parent: { type: "phases", id: phaseId },
        order: "c",
      })

      return { blockedId, blockingId, otherId }
    })

    await actor.mutation(api.tasks.blockers.mutations.addBlocker, {
      blockedTaskId: blockedId,
      blockingTaskId: blockingId,
    })

    const potential = await actor.query(
      api.tasks.blockers.queries.listPotentialBlockers,
      { taskId: blockedId }
    )

    expect(potential.map((task) => task._id)).toEqual([otherId])
  })

  test("addBlocker rejects tasks from different roots", async () => {
    const t = convexTest(schema, modules)
    const { client: actor } = await withVolunteerTestClient(t)
    const { competitionTaskId, projectTaskId } = await t.run(async (ctx) => {
      const competitionId = await insertCompetition(ctx)
      const competitionPhaseId = await insertPhase(
        ctx,
        competitionId,
        "Setup",
        "a"
      )
      const competitionTaskId = await insertTask(ctx, {
        name: "Competition task",
        parent: { type: "phases", id: competitionPhaseId },
        order: "a",
      })

      const projectId = await insertBlankProject(ctx)
      const projectPhaseId = await insertProjectPhase(
        ctx,
        projectId,
        "Setup",
        "a"
      )
      const projectTaskId = await insertTask(ctx, {
        name: "Project task",
        parent: { type: "phases", id: projectPhaseId },
        order: "a",
      })

      return { competitionTaskId, projectTaskId }
    })

    await expect(
      actor.mutation(api.tasks.blockers.mutations.addBlocker, {
        blockedTaskId: competitionTaskId,
        blockingTaskId: projectTaskId,
      })
    ).rejects.toThrow("Blockers must belong to the same competition or project")
  })

  test("blockingCount reflects outgoing blocker edges on the blocking task", async () => {
    const t = convexTest(schema, modules)
    const { client: actor } = await withVolunteerTestClient(t)
    const { parentId, blockedChildId, blockingTaskId } = await t.run(
      async (ctx) => {
        const competitionId = await insertCompetition(ctx)
        const phaseId = await insertPhase(ctx, competitionId, "Setup", "a")
        const parentId = await insertTask(ctx, {
          name: "Parent task",
          parent: { type: "phases", id: phaseId },
          order: "a",
        })
        const blockedChildId = await insertTask(ctx, {
          name: "Blocked child",
          parent: { type: "tasks", id: parentId },
          order: "a",
          status: "to-do",
        })
        const blockingTaskId = await insertTask(ctx, {
          name: "Blocking task",
          parent: { type: "tasks", id: parentId },
          order: "b",
          status: "in-progress",
        })

        await ctx.db.insert("taskBlockers", {
          blockedTaskId: blockedChildId,
          blockingTaskId,
        })

        return { parentId, blockedChildId, blockingTaskId }
      }
    )

    const view = await actor.query(api.tasks.queries.getSubtaskView, {
      owner: { type: "tasks", id: parentId },
    })

    const blockedRow = view.sections[0]?.rows.find(
      (row) => row.task._id === blockedChildId
    )
    const blockingRow = view.sections[0]?.rows.find(
      (row) => row.task._id === blockingTaskId
    )

    expect(blockedRow?.blockers).toMatchObject({
      openCount: 1,
      blockingCount: 0,
    })
    expect(blockedRow?.dependencyStatuses).toEqual(["blocked"])

    expect(blockingRow?.blockers).toMatchObject({
      openCount: 0,
      blockingCount: 1,
    })
    expect(blockingRow?.dependencyStatuses).toEqual(["blocking"])
  })

  test("dependencyStatuses returns both blocked and blocking for a task in both roles", async () => {
    const t = convexTest(schema, modules)
    const { client: actor } = await withVolunteerTestClient(t)
    const { parentId, middleId } = await t.run(async (ctx) => {
      const competitionId = await insertCompetition(ctx)
      const phaseId = await insertPhase(ctx, competitionId, "Setup", "a")
      const parentId = await insertTask(ctx, {
        name: "Parent task",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const upstreamId = await insertTask(ctx, {
        name: "Upstream task",
        parent: { type: "tasks", id: parentId },
        order: "a",
        status: "in-progress",
      })
      const middleId = await insertTask(ctx, {
        name: "Middle task",
        parent: { type: "tasks", id: parentId },
        order: "b",
        status: "to-do",
      })
      const downstreamId = await insertTask(ctx, {
        name: "Downstream task",
        parent: { type: "tasks", id: parentId },
        order: "c",
        status: "to-do",
      })

      // upstream blocks middle, middle blocks downstream
      await Promise.all([
        ctx.db.insert("taskBlockers", {
          blockedTaskId: middleId,
          blockingTaskId: upstreamId,
        }),
        ctx.db.insert("taskBlockers", {
          blockedTaskId: downstreamId,
          blockingTaskId: middleId,
        }),
      ])

      return { parentId, middleId }
    })

    const view = await actor.query(api.tasks.queries.getSubtaskView, {
      owner: { type: "tasks", id: parentId },
    })

    const middleRow = view.sections[0]?.rows.find(
      (row) => row.task._id === middleId
    )

    expect(middleRow?.blockers).toMatchObject({
      openCount: 1,
      blockingCount: 1,
    })
    expect(middleRow?.dependencyStatuses).toEqual(["blocked", "blocking"])
  })
})
