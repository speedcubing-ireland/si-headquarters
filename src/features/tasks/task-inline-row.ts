import type { FunctionReturnType } from "convex/server"
import type { api } from "@/convex/_generated/api"

export type TaskInlineRow = FunctionReturnType<
  typeof api.tasks.queries.getSubtaskView
>["sections"][number]["rows"][number]

export type TaskBoardRow = FunctionReturnType<
  typeof api.tasks.board.listForBoard
>[number]

export function taskOwnerSelectorValue(owner: TaskBoardRow["owner"]) {
  if (owner?.type === "users") {
    return { type: "users" as const, id: owner._id }
  }
  if (owner?.type === "teams") {
    return { type: "teams" as const, id: owner._id }
  }
  return null
}
