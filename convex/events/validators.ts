import { v, type Infer } from "convex/values"

export const eventRoundValidator = v.object({
  eventId: v.string(),
  rounds: v.number(),
})

export type EventRound = Infer<typeof eventRoundValidator>

export const eventReportSourceValidator = v.object({
  competitionId: v.id("competitions"),
  competitionName: v.string(),
  dates: v.object({
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  }),
  sheet: v.object({
    sheetId: v.string(),
    title: v.string(),
    url: v.string(),
  }),
  wcaCompetition: v.union(
    v.object({
      id: v.string(),
      url: v.nullable(v.string()),
    }),
    v.null()
  ),
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

export const eventReportRowValidator = v.object({
  ...eventReportSourceValidator.fields,
  events: v.array(eventRoundValidator),
  fetchedAt: v.union(v.number(), v.null()),
  error: v.union(v.string(), v.null()),
})

export type EventReportRow = Infer<typeof eventReportRowValidator>
