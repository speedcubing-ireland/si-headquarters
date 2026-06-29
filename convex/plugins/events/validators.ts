import { defineTable } from "convex/server"
import { v, type Infer } from "convex/values"

export const eventRoundValidator = v.object({
  eventId: v.string(),
  rounds: v.number(),
})

export type EventRound = Infer<typeof eventRoundValidator>

/**
 * Where a competition's event schedule was sourced from.
 *
 * - `wca` — the public WCIF of an announced WCA competition.
 * - `sheet` — the linked Google Sheet schedule (used while the competition is
 *   not yet public on the WCA website).
 *
 * Competitions with neither source available are dropped from the report
 * rather than represented here.
 */
export const eventReportSourceKindValidator = v.union(
  v.literal("wca"),
  v.literal("sheet")
)

export type EventReportSourceKind = Infer<typeof eventReportSourceKindValidator>

export const eventReportSheetValidator = v.object({
  sheetId: v.string(),
  title: v.string(),
  url: v.string(),
})

export type EventReportSheet = Infer<typeof eventReportSheetValidator>

export const eventReportWcaValidator = v.object({
  id: v.string(),
  url: v.nullable(v.string()),
  /** Whether the competition is publicly visible (announced) on the WCA. */
  isPublic: v.boolean(),
})

export type EventReportWca = Infer<typeof eventReportWcaValidator>

export const eventReportSourceValidator = v.object({
  /** Stable identity for the row (WCA id when present, else the HQ comp id). */
  key: v.string(),
  /** HQ competition record, when one exists for this competition. */
  competitionId: v.nullable(v.id("competitions")),
  competitionName: v.string(),
  dates: v.object({
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  }),
  sheet: v.nullable(eventReportSheetValidator),
  wcaCompetition: v.nullable(eventReportWcaValidator),
})

export type EventReportSource = Infer<typeof eventReportSourceValidator>

export const eventScheduleSnapshotFields = {
  sheetId: v.string(),
  events: v.array(eventRoundValidator),
  fetchedAt: v.number(),
}

export const eventScheduleSnapshotValidator = v.object(
  eventScheduleSnapshotFields
)

export type EventScheduleSnapshot = Infer<typeof eventScheduleSnapshotValidator>

export const wcaEventSnapshotFields = {
  wcaCompetitionId: v.string(),
  events: v.array(eventRoundValidator),
  fetchedAt: v.number(),
}

export const wcaEventSnapshotValidator = v.object(wcaEventSnapshotFields)

export type WcaEventSnapshot = Infer<typeof wcaEventSnapshotValidator>

export const eventsTables = {
  eventScheduleSnapshots: defineTable(eventScheduleSnapshotFields).index(
    "by_sheetId",
    ["sheetId"]
  ),
  wcaEventSnapshots: defineTable(wcaEventSnapshotFields).index(
    "by_wcaCompetitionId",
    ["wcaCompetitionId"]
  ),
}

export const eventReportRowValidator = v.object({
  ...eventReportSourceValidator.fields,
  source: eventReportSourceKindValidator,
  events: v.array(eventRoundValidator),
  fetchedAt: v.union(v.number(), v.null()),
  error: v.union(v.string(), v.null()),
})

export type EventReportRow = Infer<typeof eventReportRowValidator>
