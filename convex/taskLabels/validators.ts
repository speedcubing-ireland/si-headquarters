import { v } from "convex/values"

export const taskLabelsFields = {
  name: v.string(),
}

export const taskLabelAssignments = {
  taskId: v.id("tasks"),
  labelId: v.id("taskLabels"),
}