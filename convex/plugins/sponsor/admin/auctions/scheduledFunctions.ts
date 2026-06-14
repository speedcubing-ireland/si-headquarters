import {
  getFunctionName,
  type SchedulableFunctionReference,
} from "convex/server"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"

export async function isExpectedPendingSchedule(
  ctx: MutationCtx,
  scheduledFunctionId: Id<"_scheduled_functions"> | undefined,
  expected: {
    functionReference: SchedulableFunctionReference
    scheduledTime: number
    argument: readonly [name: string, value: string]
  }
): Promise<boolean> {
  if (scheduledFunctionId === undefined) return false

  const scheduled = await ctx.db.system.get(
    "_scheduled_functions",
    scheduledFunctionId
  )
  if (scheduled?.state.kind !== "pending") {
    return false
  }
  if (scheduled.name !== getFunctionName(expected.functionReference)) {
    return false
  }

  const [name, value] = expected.argument
  if (JSON.stringify(scheduled.args) !== JSON.stringify([{ [name]: value }])) {
    return false
  }

  const now = Date.now()
  return expected.scheduledTime <= now
    ? scheduled.scheduledTime <= now
    : scheduled.scheduledTime === expected.scheduledTime
}
