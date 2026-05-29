import { parseTaskListPageSnapshot } from "@/features/tasks/list/task-list-serialize"
import { parseJson } from "@/features/tasks/list/task-list-parse"
import type { TaskListPageSnapshot } from "@/features/tasks/list/task-list-types"

const STORAGE_VERSION = "v1"

function storageKey(pageId: string) {
  return `tasks-list:${STORAGE_VERSION}:${pageId}`
}

export function readTaskListPageSnapshot(
  pageId: string
): TaskListPageSnapshot | null {
  try {
    const raw = localStorage.getItem(storageKey(pageId))
    if (raw === null || raw === "") return null
    const data = parseJson(raw)
    if (data === null) return null
    return parseTaskListPageSnapshot(data)
  } catch {
    return null
  }
}

export function writeTaskListPageSnapshot(
  pageId: string,
  snapshot: TaskListPageSnapshot
): void {
  try {
    localStorage.setItem(storageKey(pageId), JSON.stringify(snapshot))
  } catch {
    // Quota or private browsing — ignore.
  }
}
