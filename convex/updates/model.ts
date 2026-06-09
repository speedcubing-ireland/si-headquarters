import type { Doc } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"

type DbCtx = Pick<QueryCtx | MutationCtx, "db">

export async function getCurrentUpdateForObject(
  ctx: DbCtx,
  object: Doc<"objectUpdates">["object"]
): Promise<Doc<"objectUpdates"> | null> {
  const updates = await ctx.db
    .query("objectUpdates")
    .withIndex("by_object_type_and_object_id", (q) =>
      q.eq("object.type", object.type).eq("object.id", object.id)
    )
    .take(2)

  if (updates.length > 1) {
    throw new Error("Object has more than one current update.")
  }

  return updates[0] ?? null
}
