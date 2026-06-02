import type { Doc } from "@/convex/_generated/dataModel"

export type TaskLabelOption = Pick<
  Doc<"taskLabels">,
  "_id" | "code" | "name" | "color"
>

export function formatTaskLabelCount(labelCount: number) {
  return `+${String(labelCount)} Labels`
}

export function formatCompactTaskLabelCount(labelCount: number) {
  return `+${String(labelCount)}`
}
