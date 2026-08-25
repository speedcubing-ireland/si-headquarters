import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"

export async function cancelScheduledFunction(
  ctx: MutationCtx,
  id: Id<"_scheduled_functions"> | null | undefined
): Promise<void> {
  if (id === null || id === undefined) return
  try {
    await ctx.scheduler.cancel(id)
  } catch {
    // A completed or concurrently cancelled schedule needs no further cleanup.
  }
}
