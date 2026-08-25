import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { scheduleCommentsDeletion } from "@/convex/comments/deletion"
import {
  createDeletionBudget,
  requireDeletionHeadroom,
  reserveDeletionWork,
} from "@/convex/deletion/budget"
import { runDeletionWork } from "@/convex/deletion/work"
import type { PreparedCompetitionPluginDeletion } from "@/convex/competitions/deletionPlugin"
import { COMPETITION_DELETION_PLUGINS } from "@/convex/plugins/registry"
import {
  executeTaskDeletion,
  MAX_TASK_DELETE_COUNT,
  prepareTaskDeletion,
  type TaskDeletionPlan,
} from "@/convex/tasks/deletion"
import { scheduleUpdateReactionsDeletion } from "@/convex/updates/deletion"
import { ConvexError } from "convex/values"

const MAX_COMPETITION_PHASES = 100
const MAX_COMPETITION_SCOPED_ROWS = 500

interface CompetitionDeletionPlan {
  competition: Doc<"competitions">
  linkedResources: Doc<"objectLinkedResources">[]
  organiserInvites: Doc<"competitionOrganiserInvites">[]
  phases: Doc<"phases">[]
  pluginCleanups: PreparedCompetitionPluginDeletion[]
  sponsorOverrides: Doc<"competitionSponsorOverrides">[]
  subscriptions: Doc<"subscriptions">[]
  tasks: TaskDeletionPlan
  updates: Doc<"objectUpdates">[]
}

function requireBoundedRowCount(
  rowCount: number,
  limit: number,
  collection: string
): void {
  if (rowCount > limit) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Competition has more than ${String(limit)} ${collection}.`,
    })
  }
}

async function prepareCompetitionDeletion(
  ctx: MutationCtx,
  competition: Doc<"competitions">
): Promise<CompetitionDeletionPlan> {
  const budget = createDeletionBudget()
  const [
    tasks,
    phases,
    organiserInvites,
    subscriptions,
    linkedResources,
    updates,
    sponsorOverrides,
  ] = await Promise.all([
    ctx.db
      .query("tasks")
      .withIndex("by_root_type_and_root_id", (q) =>
        q.eq("root.type", "competitions").eq("root.id", competition._id)
      )
      .take(MAX_TASK_DELETE_COUNT + 1),
    ctx.db
      .query("phases")
      .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
        q.eq("owner.type", "competitions").eq("owner.id", competition._id)
      )
      .take(MAX_COMPETITION_PHASES + 1),
    ctx.db
      .query("competitionOrganiserInvites")
      .withIndex("by_competitionId", (q) =>
        q.eq("competitionId", competition._id)
      )
      .take(MAX_COMPETITION_SCOPED_ROWS + 1),
    ctx.db
      .query("subscriptions")
      .withIndex("by_object_type_and_object_id_and_userId", (q) =>
        q.eq("object.type", "competitions").eq("object.id", competition._id)
      )
      .take(MAX_COMPETITION_SCOPED_ROWS + 1),
    ctx.db
      .query("objectLinkedResources")
      .withIndex("by_object_type_and_object_id", (q) =>
        q.eq("object.type", "competitions").eq("object.id", competition._id)
      )
      .take(MAX_COMPETITION_SCOPED_ROWS + 1),
    ctx.db
      .query("objectUpdates")
      .withIndex("by_object_type_and_object_id", (q) =>
        q.eq("object.type", "competitions").eq("object.id", competition._id)
      )
      .take(MAX_COMPETITION_SCOPED_ROWS + 1),
    ctx.db
      .query("competitionSponsorOverrides")
      .withIndex("by_competitionId", (q) =>
        q.eq("competitionId", competition._id)
      )
      .take(MAX_COMPETITION_SCOPED_ROWS + 1),
  ])

  requireBoundedRowCount(tasks.length, MAX_TASK_DELETE_COUNT, "tasks")
  requireBoundedRowCount(phases.length, MAX_COMPETITION_PHASES, "phases")
  requireBoundedRowCount(
    organiserInvites.length,
    MAX_COMPETITION_SCOPED_ROWS,
    "organiser invites"
  )
  requireBoundedRowCount(
    subscriptions.length,
    MAX_COMPETITION_SCOPED_ROWS,
    "subscriptions"
  )
  requireBoundedRowCount(
    linkedResources.length,
    MAX_COMPETITION_SCOPED_ROWS,
    "linked resources"
  )
  requireBoundedRowCount(updates.length, MAX_COMPETITION_SCOPED_ROWS, "updates")
  requireBoundedRowCount(
    sponsorOverrides.length,
    MAX_COMPETITION_SCOPED_ROWS,
    "sponsor overrides"
  )

  reserveDeletionWork(budget, {
    reason: "competition-owned records",
    scheduledFunctions: updates.length + 1,
    writes:
      1 +
      phases.length +
      organiserInvites.length +
      subscriptions.length +
      linkedResources.length +
      updates.length +
      sponsorOverrides.length,
  })
  const [taskPlan, pluginCleanups] = await Promise.all([
    prepareTaskDeletion(
      ctx,
      tasks.map((task) => task._id),
      budget
    ),
    Promise.all(
      COMPETITION_DELETION_PLUGINS.map(
        async (plugin) =>
          await plugin.prepareCompetitionDeletion(ctx, {
            budget,
            competition,
          })
      )
    ),
  ])
  await requireDeletionHeadroom(ctx, budget)

  return {
    competition,
    linkedResources,
    organiserInvites,
    phases,
    pluginCleanups,
    sponsorOverrides,
    subscriptions,
    tasks: taskPlan,
    updates,
  }
}

async function executeCompetitionDeletion(
  ctx: MutationCtx,
  plan: CompetitionDeletionPlan
): Promise<void> {
  await executeTaskDeletion(ctx, plan.tasks)
  for (const pluginCleanup of plan.pluginCleanups) {
    await pluginCleanup.execute()
  }
  await runDeletionWork(plan.updates, async (update) => {
    await scheduleUpdateReactionsDeletion(ctx, update._id)
  })
  await scheduleCommentsDeletion(ctx, {
    type: "competitions",
    id: plan.competition._id,
  })

  await Promise.all([
    runDeletionWork(plan.phases, async (row) => {
      await ctx.db.delete("phases", row._id)
    }),
    runDeletionWork(plan.organiserInvites, async (row) => {
      await ctx.db.delete("competitionOrganiserInvites", row._id)
    }),
    runDeletionWork(plan.subscriptions, async (row) => {
      await ctx.db.delete("subscriptions", row._id)
    }),
    runDeletionWork(plan.linkedResources, async (row) => {
      await ctx.db.delete("objectLinkedResources", row._id)
    }),
    runDeletionWork(plan.updates, async (row) => {
      await ctx.db.delete("objectUpdates", row._id)
    }),
    runDeletionWork(plan.sponsorOverrides, async (row) => {
      await ctx.db.delete("competitionSponsorOverrides", row._id)
    }),
  ])
  await ctx.db.delete("competitions", plan.competition._id)
}

export async function deleteCompetitionRows(
  ctx: MutationCtx,
  competitionId: Id<"competitions">
): Promise<void> {
  const competition = await ctx.db.get("competitions", competitionId)
  if (competition === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Competition not found",
    })
  }
  const plan = await prepareCompetitionDeletion(ctx, competition)
  await executeCompetitionDeletion(ctx, plan)
}
