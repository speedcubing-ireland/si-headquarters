import { v } from "convex/values"

export const TASK_KINDS = ["standard", "flow"] as const

export const taskKindType = v.union(
  ...TASK_KINDS.map((kind) => v.literal(kind))
)

export type TaskKind = (typeof TASK_KINDS)[number]
