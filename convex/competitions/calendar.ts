import type { Doc, Id } from "@/convex/_generated/dataModel"
import { query } from "@/convex/_generated/server"
import type { QueryCtx } from "@/convex/_generated/server"
import { requireUserId } from "@/convex/lib/requireUser"
import {
  formatLocalDate,
  getSaturdayOfWeek,
  parseCompDateRange,
  saturdaysInYear,
  weekendLabel,
} from "@/convex/lib/competitionWeekends"
import {
  competitionPhaseSnapshot,
  competitionPhaseValidator,
} from "@/convex/competitions/phaseSnapshot"
import { getPublicUser } from "@/convex/users/queries"
import { publicUserValidator } from "@/convex/users/validators"
import { v } from "convex/values"

const calendarCompetitionRow = v.object({
  kind: v.literal("competition"),
  _id: v.id("competitions"),
  name: v.string(),
  compDates: v.object({
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  }),
  phase: competitionPhaseValidator,
  compLead: v.union(publicUserValidator, v.null()),
  leadDelegate: v.union(publicUserValidator, v.null()),
  organisers: v.array(publicUserValidator),
})

const calendarWeekendRow = v.object({
  kind: v.literal("weekend"),
  weekendStart: v.string(),
  weekendLabel: v.string(),
  note: v.string(),
  announced: v.boolean(),
  reserved: v.boolean(),
})

export const calendarRowValidator = v.union(
  calendarCompetitionRow,
  calendarWeekendRow
)

type CalendarCompetitionRow = {
  kind: "competition"
  _id: Id<"competitions">
  name: string
  compDates: Doc<"competitions">["compDates"]
  phase: {
    _id: Id<"phases">
    name: string
    color: Doc<"phases">["color"]
  } | null
  compLead: Awaited<ReturnType<typeof getPublicUser>>
  leadDelegate: Awaited<ReturnType<typeof getPublicUser>>
  organisers: NonNullable<Awaited<ReturnType<typeof getPublicUser>>>[]
}

async function buildCompetitionRow(
  ctx: QueryCtx,
  competition: Doc<"competitions">,
  phaseById: Map<Id<"phases">, Doc<"phases">>
): Promise<CalendarCompetitionRow> {
  const [compLead, leadDelegate, ...organisers] = await Promise.all([
    getPublicUser(ctx, competition.people.compLead),
    getPublicUser(ctx, competition.people.leadDelegate),
    ...competition.people.organisers.map((userId) =>
      getPublicUser(ctx, userId)
    ),
  ])

  const phase = competitionPhaseSnapshot(
    competition.phaseId ? phaseById.get(competition.phaseId) : null
  )

  return {
    kind: "competition",
    _id: competition._id,
    name: competition.name,
    compDates: competition.compDates,
    phase,
    compLead,
    leadDelegate,
    organisers: organisers.filter(
      (user): user is NonNullable<typeof user> => user !== null
    ),
  }
}

function assignCompetitionToWeekend(
  assignments: Map<string, Id<"competitions">[]>,
  weekendStart: string,
  competitionId: Id<"competitions">
) {
  const existing = assignments.get(weekendStart) ?? []
  if (!existing.includes(competitionId)) {
    existing.push(competitionId)
    assignments.set(weekendStart, existing)
  }
}

export const listForYear = query({
  args: { year: v.number() },
  returns: v.object({
    rows: v.array(calendarRowValidator),
    unscheduledCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireUserId(ctx)

    const [competitions, phases, slots] = await Promise.all([
      ctx.db.query("competitions").collect(),
      ctx.db.query("phases").collect(),
      ctx.db
        .query("competitionWeekendSlots")
        .withIndex("by_year", (q) => q.eq("year", args.year))
        .collect(),
    ])

    const phaseById = new Map(phases.map((phase) => [phase._id, phase]))
    const slotByWeekend = new Map(
      slots.map((slot) => [slot.weekendStart, slot])
    )

    const competitionRows = new Map<Id<"competitions">, CalendarCompetitionRow>()
    const assignments = new Map<string, Id<"competitions">[]>()
    const unscheduled: Id<"competitions">[] = []
    const yearWeekends = saturdaysInYear(args.year)

    for (const competition of competitions) {
      const range = parseCompDateRange(
        competition.compDates.from,
        competition.compDates.to
      )

      if (range === null) {
        unscheduled.push(competition._id)
        continue
      }

      const weekendStart = formatLocalDate(getSaturdayOfWeek(range.start))
      if (yearWeekends.includes(weekendStart)) {
        assignCompetitionToWeekend(
          assignments,
          weekendStart,
          competition._id
        )
      } else {
        unscheduled.push(competition._id)
      }
    }

    const assignedIds: Id<"competitions">[] = []
    for (const ids of assignments.values()) {
      assignedIds.push(...ids)
    }
    const neededIds = new Set<Id<"competitions">>([...assignedIds, ...unscheduled])

    await Promise.all(
      competitions
        .filter((competition) => neededIds.has(competition._id))
        .map(async (competition) => {
          competitionRows.set(
            competition._id,
            await buildCompetitionRow(ctx, competition, phaseById)
          )
        })
    )

    const rows: Array<
      | CalendarCompetitionRow
      | {
          kind: "weekend"
          weekendStart: string
          weekendLabel: string
          note: string
          announced: boolean
          reserved: boolean
        }
    > = []

    for (const weekendStart of saturdaysInYear(args.year)) {
      const competitionIds = assignments.get(weekendStart) ?? []

      if (competitionIds.length > 0) {
        for (const competitionId of competitionIds) {
          const row = competitionRows.get(competitionId)
          if (row) rows.push(row)
        }
        continue
      }

      const slot = slotByWeekend.get(weekendStart)
      rows.push({
        kind: "weekend",
        weekendStart,
        weekendLabel: weekendLabel(weekendStart),
        note: slot?.note ?? "",
        announced: slot?.announced ?? false,
        reserved: slot?.reserved ?? false,
      })
    }

    for (const competitionId of unscheduled) {
      const row = competitionRows.get(competitionId)
      if (row) rows.push(row)
    }

    return {
      rows,
      unscheduledCount: unscheduled.length,
    }
  },
})
