import { ConvexError } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"

export const MAX_PHASES_FOR_OWNER = 50

type DbCtx = Pick<QueryCtx | MutationCtx, "db">
export type PhaseOwner = Doc<"phases">["owner"]

export function listPhasesForOwner(ctx: DbCtx, owner: PhaseOwner) {
  return ctx.db
    .query("phases")
    .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
      q.eq("owner.type", owner.type).eq("owner.id", owner.id)
    )
    .collect()
}

export async function listPhasesForOwnerBounded(ctx: DbCtx, owner: PhaseOwner) {
  const phases = await ctx.db
    .query("phases")
    .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
      q.eq("owner.type", owner.type).eq("owner.id", owner.id)
    )
    .order("asc")
    .take(MAX_PHASES_FOR_OWNER + 1)

  if (phases.length > MAX_PHASES_FOR_OWNER) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Too many phases to manage at once.",
    })
  }

  return phases
}

export async function getOwnerCurrentPhaseId(
  ctx: DbCtx,
  owner: PhaseOwner
): Promise<Id<"phases"> | null> {
  if (owner.type === "competitions") {
    const competition = await ctx.db.get("competitions", owner.id)
    return competition?.phaseId ?? null
  }

  const project = await ctx.db.get("projects", owner.id)
  return project?.phaseId ?? null
}

export async function clearOwnerCurrentPhaseId(
  ctx: MutationCtx,
  owner: PhaseOwner
): Promise<void> {
  const table = owner.type
  const doc = await ctx.db.get(table, owner.id)
  if (doc?.phaseId == null) {
    return
  }

  await ctx.db.patch(table, owner.id, { phaseId: null })
}

export async function hasPhaseTasks(ctx: DbCtx, phaseId: Id<"phases">) {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
      q.eq("parent.type", "phases").eq("parent.id", phaseId)
    )
    .take(1)

  return tasks.length > 0
}
