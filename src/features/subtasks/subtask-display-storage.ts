import { z } from "zod"

const STORAGE_KEY = "subtask-view-display:v1"

export interface SubtaskDisplayOptions {
  hideCompleted: boolean
  hideSubtasks: boolean
}

export const defaultSubtaskDisplayOptions: SubtaskDisplayOptions = {
  hideCompleted: false,
  hideSubtasks: true,
}

const subtaskDisplayOptionsSchema = z.object({
  hideCompleted: z.boolean(),
  hideSubtasks: z.boolean(),
})

function writeLocalStorageOrIgnore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    void 0
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
