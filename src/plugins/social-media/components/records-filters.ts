import { localDateOffset, localToday } from "@/convex/notifications/localTime"

/** Competition end dates, inclusive; null leaves that end open. */
export interface RecordsPeriod {
  from: string | null
  to: string | null
}

export const RECORDS_PERIOD_PRESETS = [
  { days: 28, label: "Last 4 weeks" },
  { days: 91, label: "Last 3 months" },
  { days: 365, label: "Last 12 months" },
] as const

export function presetPeriod(days: number): RecordsPeriod {
  return { from: localDateOffset(localToday(), -days), to: null }
}

export function defaultRecordsPeriod(): RecordsPeriod {
  return presetPeriod(RECORDS_PERIOD_PRESETS[0].days)
}

/** A competitor by WCA ID, or by name for a newcomer who has none yet. */
export interface RecordsPerson {
  key: string
  name: string
}

export function recordsPersonKey(record: {
  wcaId: string | null
  personName: string
}): string {
  return record.wcaId ?? `name:${record.personName}`
}
