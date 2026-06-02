import { v } from "convex/values"

export const taskLabelColorType = v.union(
  v.literal("slate"),
  v.literal("rose"),
  v.literal("amber"),
  v.literal("emerald"),
  v.literal("teal"),
  v.literal("sky"),
  v.literal("indigo"),
  v.literal("violet")
)

export const taskLabelsFields = {
  code: v.string(),
  name: v.string(),
  color: taskLabelColorType,
}

export const taskLabelAssignments = {
  taskId: v.id("tasks"),
  labelId: v.id("taskLabels"),
}
