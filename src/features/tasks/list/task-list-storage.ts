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
    if (!raw) return null
    return JSON.parse(raw) as TaskListPageSnapshot
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
