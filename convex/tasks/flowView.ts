// to-do this and subtask needs to have thier files properly cleaned up and moved

import {
  taskViewDisplayFields,
  taskViewStatusView,
  taskViewStructureTask,
  taskViewTaskDetails,
  type TaskViewProgress,
  type TaskViewTaskDetails,
} from "@/convex/tasks/view"
import { v, type Infer } from "convex/values"

export const flowViewTaskDetails = taskViewTaskDetails

const flowViewParentSummary = v.object({
  taskId: v.id("tasks"),
  currentStepId: v.union(v.id("tasks"), v.null()),
  currentStepIndex: v.union(v.number(), v.null()),
  totalSteps: v.number(),
})

export const taskFlowView = v.object({
  parent: flowViewParentSummary,
  steps: v.array(flowViewTaskDetails),
})

export const taskFlowStructure = v.object({
  parent: flowViewParentSummary,
  steps: v.array(
    v.object({
      task: taskViewStructureTask,
      statusView: taskViewStatusView,
    })
  ),
})

export const taskFlowDisplay = v.object({
  steps: v.array(taskViewDisplayFields),
})

export type FlowViewProgress = TaskViewProgress
export type TaskFlowViewTaskDetails = TaskViewTaskDetails
export type TaskFlowView = Infer<typeof taskFlowView>
export type TaskFlowStructure = Infer<typeof taskFlowStructure>
export type TaskFlowDisplay = Infer<typeof taskFlowDisplay>
