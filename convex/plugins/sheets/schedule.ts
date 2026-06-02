export const SCHEDULE_RANGES = {
  groupBlocks: "Schedule!AH6:AK",
  eventBlocks: "Schedule!AM6:AP",
  progression: "Schedule!A2:F",
} as const

export const WCA_DATA_RANGE = "WCA Data!A3:U"
export const WCA_DATA_START = "WCA Data!A3"

export const SCHEDULE_CACHE_TTL_MS = 5 * 60 * 1000

export interface ScheduleReadResult {
  groupBlocks: string[][]
  eventBlocks: string[][]
  progression: string[][]
}

export function parseSheetValues(values: string[][] | undefined): string[][] {
  if (values === undefined) {
    return []
  }
  return values.map((row) => row.map((cell) => cell))
}
