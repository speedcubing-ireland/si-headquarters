import { z } from "zod"

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

const subtaskDisplayOptionsSchema = z.object({
  hideCompleted: z.boolean(),
  hideSubtasks: z.boolean(),
})

function writeLocalStorageOrIgnore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* quota exceeded or private browsing */
  }
}

export function readSubtaskDisplayOptions(): SubtaskDisplayOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null || raw === "") return defaultSubtaskDisplayOptions
    const parsed = subtaskDisplayOptionsSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : defaultSubtaskDisplayOptions
  } catch {
    return defaultSubtaskDisplayOptions
  }
}

export function writeSubtaskDisplayOptions(
  options: SubtaskDisplayOptions
): void {
  writeLocalStorageOrIgnore(STORAGE_KEY, JSON.stringify(options))
}
