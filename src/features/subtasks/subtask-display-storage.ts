// One combined display preference shared by task and competition subtask views.
const STORAGE_KEY = "subtask-view-display:v1"

export interface SubtaskDisplayOptions {
  hideCompleted: boolean
  hideSubtasks: boolean
}

export const defaultSubtaskDisplayOptions: SubtaskDisplayOptions = {
  hideCompleted: false,
  hideSubtasks: false,
}

function writeLocalStorageOrIgnore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* quota exceeded or private browsing */
  }
}

function parseSubtaskDisplayOptions(data: unknown): SubtaskDisplayOptions | null {
  if (typeof data !== "object" || data === null) return null
  const record = data as Record<string, unknown>
  if (
    typeof record.hideCompleted !== "boolean" ||
    typeof record.hideSubtasks !== "boolean"
  ) {
    return null
  }
  return {
    hideCompleted: record.hideCompleted,
    hideSubtasks: record.hideSubtasks,
  }
}

export function readSubtaskDisplayOptions(): SubtaskDisplayOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null || raw === "") return defaultSubtaskDisplayOptions
    const data = JSON.parse(raw) as unknown
    return parseSubtaskDisplayOptions(data) ?? defaultSubtaskDisplayOptions
  } catch {
    return defaultSubtaskDisplayOptions
  }
}

export function writeSubtaskDisplayOptions(options: SubtaskDisplayOptions): void {
  writeLocalStorageOrIgnore(STORAGE_KEY, JSON.stringify(options))
}
