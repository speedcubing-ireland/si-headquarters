export const SCHEDULE_RANGES = {
  saturday: "Schedule!AH6:AK",
  sunday: "Schedule!AM6:AP",
  progression: "Schedule!A2:F",
} as const

export const WCA_DATA_RANGE = "WCA Data!A3:U"
export const WCA_DATA_START = "WCA Data!A3"

export interface ScheduleReadResult {
  saturday: string[][]
  sunday: string[][]
  progression: string[][]
}

export interface ProgressionRow {
  eventId: string
  roundCount: number | null
  progressions: (number | null)[]
}

export interface ScheduleEventRound {
  eventId: string
  rounds: number
}

export const EVENT_NAME_TO_ID: Readonly<Partial<Record<string, string>>> = {
  "3x3": "333",
  "2x2": "222",
  "4x4": "444",
  "5x5": "555",
  "6x6": "666",
  "7x7": "777",
  "3x3 blindfolded": "333bf",
  "3x3 fewest moves": "333fm",
  "3x3 one-handed": "333oh",
  clock: "clock",
  megaminx: "minx",
  pyraminx: "pyram",
  skewb: "skewb",
  "square-1": "sq1",
  "4x4 blindfolded": "444bf",
  "5x5 blindfolded": "555bf",
  "3x3 multi-blind": "333mbf",
}

export function normalizeScheduleName(name: string): string {
  return name.trim().toLowerCase()
}

export function wcaEventIdForScheduleName(name: string): string | undefined {
  return EVENT_NAME_TO_ID[normalizeScheduleName(name)]
}

export function parseProgressionRows(rows: string[][]): ProgressionRow[] {
  const progressions: ProgressionRow[] = []

  for (const row of rows) {
    const eventId = wcaEventIdForScheduleName(row[0] ?? "")
    if (eventId === undefined) {
      continue
    }

    const roundCount = Number((row[1] ?? "").trim())
    const validRoundCount =
      Number.isInteger(roundCount) && roundCount > 0 ? roundCount : null

    const progressionValues: (number | null)[] = []
    for (let index = 2; index < 6; index++) {
      const value = (row[index] ?? "").trim()
      const parsed = Number(value)
      progressionValues.push(
        value !== "" && Number.isFinite(parsed) ? parsed : null
      )
    }

    progressions.push({
      eventId,
      roundCount: validRoundCount,
      progressions: progressionValues,
    })
  }

  return progressions
}

export function parseScheduleEventRounds(
  rows: string[][]
): ScheduleEventRound[] {
  const events: ScheduleEventRound[] = []
  const eventIds = new Set<string>()

  for (const row of parseProgressionRows(rows)) {
    if (row.roundCount === null) {
      continue
    }
    if (eventIds.has(row.eventId)) {
      throw new Error(
        `Schedule progression contains duplicate event ${row.eventId}.`
      )
    }
    eventIds.add(row.eventId)
    events.push({ eventId: row.eventId, rounds: row.roundCount })
  }

  return events
}
