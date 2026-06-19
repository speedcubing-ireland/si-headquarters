import { parseTaskListPageSnapshot } from "@/features/tasks/list/task-list-serialize"
import type { TaskListPageSnapshot } from "@/features/tasks/list/task-list-types"
import { parseJson } from "@/lib/parsed-json"

const STORAGE_VERSION = "v2"

function storageKey(pageId: string) {
  return `tasks-list:${STORAGE_VERSION}:${pageId}`
}

function writeLocalStorageOrIgnore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    void 0
  }
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
  writeLocalStorageOrIgnore(storageKey(pageId), JSON.stringify(snapshot))
}
