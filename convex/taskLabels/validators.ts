import { v } from "convex/values"

// TODO need to add colors!
export const taskLabelsFields = {
  name: v.string(),
}

export const taskLabelAssignments = {
  taskId: v.id("tasks"),
  labelId: v.id("taskLabels"),
}