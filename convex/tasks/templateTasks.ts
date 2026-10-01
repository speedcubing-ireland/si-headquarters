import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"

/**
 * The competition task created from the given template task key, or null when
 * the competition has none (hand-built, or created before tasks carried their
 * template key and not yet backfilled).
 */
export async function findCompetitionTaskByTemplateKey(
  ctx: QueryCtx,
  competitionId: Id<"competitions">,
  templateKey: string
): Promise<Doc<"tasks"> | null> {
  return await ctx.db
    .query("tasks")
    .withIndex("by_root_type_and_root_id_and_templateKey", (q) =>
      q
        .eq("root.type", "competitions")
        .eq("root.id", competitionId)
        .eq("templateKey", templateKey)
    )
    .first()
}
