import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import { normalizeTaskLabelCode, type TaskLabelSpec } from "./constants"

type TaskLabelLookupCtx = Pick<QueryCtx | MutationCtx, "db">

export async function getTaskLabelByCode(
  ctx: TaskLabelLookupCtx,
  code: string
): Promise<Doc<"taskLabels"> | null> {
  const normalizedCode = normalizeTaskLabelCode(code)
  if (normalizedCode.length === 0) return null

  return await ctx.db
    .query("taskLabels")
    .withIndex("by_code", (q) => q.eq("code", normalizedCode))
    .first()
}

export async function ensureTaskLabel(
  ctx: MutationCtx,
  spec: TaskLabelSpec
): Promise<Id<"taskLabels">> {
  const code = normalizeTaskLabelCode(spec.code)
  if (code.length === 0) throw new Error("Task label code is required")

  const existing = await getTaskLabelByCode(ctx, code)
  if (existing) {
    await ctx.db.patch("taskLabels", existing._id, {
      name: spec.name,
      color: spec.color,
    })
    return existing._id
  }

  return await ctx.db.insert("taskLabels", {
    code,
    name: spec.name,
    color: spec.color,
  })
}
