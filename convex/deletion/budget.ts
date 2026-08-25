import { ConvexError } from "convex/values"
import type { MutationCtx } from "@/convex/_generated/server"

export const MAX_DELETION_WRITES = 8_000
const MAX_DELETION_SCHEDULES = 500

export interface DeletionBudget {
  scheduledFunctions: number
  writes: number
}

export function createDeletionBudget(): DeletionBudget {
  return { scheduledFunctions: 0, writes: 0 }
}

export function reserveDeletionWork(
  budget: DeletionBudget,
  work: { reason: string; scheduledFunctions?: number; writes?: number }
): void {
  budget.writes += work.writes ?? 0
  budget.scheduledFunctions += work.scheduledFunctions ?? 0

  if (budget.writes > MAX_DELETION_WRITES) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Deletion is too large to run safely (${work.reason}). Remove some related records first and try again.`,
    })
  }
  if (budget.scheduledFunctions > MAX_DELETION_SCHEDULES) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Deletion has too many background cleanups (${work.reason}). Remove some related records first and try again.`,
    })
  }
}

export async function requireDeletionHeadroom(
  ctx: Pick<MutationCtx, "meta">,
  budget: DeletionBudget
): Promise<void> {
  const metrics = await ctx.meta.getTransactionMetrics()
  if (
    budget.writes > metrics.documentsWritten.remaining ||
    budget.scheduledFunctions > metrics.functionsScheduled.remaining
  ) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message:
        "Deletion does not fit in the remaining transaction capacity. Remove some related records first and try again.",
    })
  }
}
