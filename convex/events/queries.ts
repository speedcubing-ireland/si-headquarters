import type { Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { internalQuery } from "@/convex/_generated/server"
import { competitionPrimaryStart } from "@/convex/competitions/dates"
import { MAX_EVENT_REPORT_SOURCES } from "@/convex/events/constants"
import { DEFAULT_RESOURCE_KEYS } from "@/convex/integrations/constants"
import { requireEventsDashboardAccess } from "@/convex/permissions/principal"
import {
  eventScheduleSnapshotValidator,
  wcaEventSnapshotValidator,
} from "@/convex/events/validators"
import { isFeatureEnabled } from "@/config/lib/organisation"
import { ConvexError, v, type Infer } from "convex/values"

/**
 * An HQ competition record that contributes to the events report, either
 * because it has a linked Google Sheet schedule or because it is linked to a
 * WCA competition we manage.
 */
export const reportCompetitionValidator = v.object({
  competitionId: v.id("competitions"),
  competitionName: v.string(),
  dates: v.object({
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  }),
  wcaCompetitionId: v.nullable(v.string()),
  sheet: v.nullable(
    v.object({
      sheetId: v.string(),
      title: v.string(),
      url: v.string(),
    })
  ),
})

export type ReportCompetition = Infer<typeof reportCompetitionValidator>

interface CompetitionSheet {
  sheetId: string
  title: string
  url: string
}

function assertWithinSourceLimit(count: number): void {
  if (count > MAX_EVENT_REPORT_SOURCES) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `The events report supports at most ${String(MAX_EVENT_REPORT_SOURCES)} linked competition sheets.`,
    })
  }
}

async function loadLinkedSheets(
  ctx: QueryCtx
): Promise<Map<Id<"competitions">, CompetitionSheet>> {
  const sheetRows = await ctx.db
    .query("objectLinkedResources")
    .withIndex(
      "by_object_type_and_resourceType_and_resourceKey_and_object_id",
      (q) =>
        q
          .eq("object.type", "competitions")
          .eq("resourceType", "googleSheet")
          .eq("resourceKey", DEFAULT_RESOURCE_KEYS.googleSheet)
    )
    .take(MAX_EVENT_REPORT_SOURCES + 1)
  assertWithinSourceLimit(sheetRows.length)

  const sheetsByCompetition = new Map<Id<"competitions">, CompetitionSheet>()
  for (const resource of sheetRows) {
    if (
      resource.object.type !== "competitions" ||
      resource.data.resourceType !== "googleSheet"
    ) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "A default Google Sheet resource has inconsistent data.",
      })
    }
    if (sheetsByCompetition.has(resource.object.id)) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Competition ${resource.object.id} has multiple default Google Sheet resources.`,
      })
    }
    sheetsByCompetition.set(resource.object.id, {
      sheetId: resource.data.sheetId,
      title: resource.data.title,
      url: resource.data.url,
    })
  }
  return sheetsByCompetition
}

async function resolveWcaLinkedCompetitionIds(
  ctx: QueryCtx,
  wcaCompetitionIds: readonly string[]
): Promise<Map<Id<"competitions">, true>> {
  const ids = new Map<Id<"competitions">, true>()
  for (const wcaCompetitionId of new Set(wcaCompetitionIds)) {
    const competition = await ctx.db
      .query("competitions")
      .withIndex("by_wcaCompetitionId", (q) =>
        q.eq("wcaCompetitionId", wcaCompetitionId)
      )
      .first()
    if (competition !== null) {
      ids.set(competition._id, true)
    }
  }
  return ids
}

async function loadReportCompetitions(
  ctx: QueryCtx,
  wcaCompetitionIds: readonly string[]
): Promise<ReportCompetition[]> {
  if (!isFeatureEnabled("events")) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Events are not enabled for this organisation.",
    })
  }
  await requireEventsDashboardAccess(ctx)

  const sheetsByCompetition = await loadLinkedSheets(ctx)
  const wcaLinkedIds = await resolveWcaLinkedCompetitionIds(
    ctx,
    wcaCompetitionIds
  )

  const competitionIds = new Set<Id<"competitions">>([
    ...sheetsByCompetition.keys(),
    ...wcaLinkedIds.keys(),
  ])

  const competitions = (
    await Promise.all(
      [...competitionIds].map(
        async (competitionId): Promise<ReportCompetition | null> => {
          const competition = await ctx.db.get("competitions", competitionId)
          if (competition === null) {
            return null
          }
          return {
            competitionId,
            competitionName: competition.name,
            dates: competition.compDates,
            wcaCompetitionId: competition.wcaCompetitionId ?? null,
            sheet: sheetsByCompetition.get(competitionId) ?? null,
          }
        }
      )
    )
  ).filter((entry): entry is ReportCompetition => entry !== null)

  return competitions.sort((left, right) => {
    const leftDate = competitionPrimaryStart(left.dates) ?? "9999-12-31"
    const rightDate = competitionPrimaryStart(right.dates) ?? "9999-12-31"
    return (
      leftDate.localeCompare(rightDate) ||
      left.competitionName.localeCompare(right.competitionName)
    )
  })
}

export const listReportSources = internalQuery({
  args: { wcaCompetitionIds: v.optional(v.array(v.string())) },
  returns: v.array(reportCompetitionValidator),
  handler: (ctx, args) =>
    loadReportCompetitions(ctx, args.wcaCompetitionIds ?? []),
})

export const loadReportContext = internalQuery({
  args: { wcaCompetitionIds: v.array(v.string()) },
  returns: v.object({
    competitions: v.array(reportCompetitionValidator),
    sheetSnapshots: v.array(eventScheduleSnapshotValidator),
    wcaSnapshots: v.array(wcaEventSnapshotValidator),
  }),
  handler: async (ctx, args) => {
    const competitions = await loadReportCompetitions(
      ctx,
      args.wcaCompetitionIds
    )

    const sheetIds = new Set<string>()
    const wcaIds = new Set<string>(args.wcaCompetitionIds)
    for (const competition of competitions) {
      if (competition.sheet !== null) {
        sheetIds.add(competition.sheet.sheetId)
      }
      if (competition.wcaCompetitionId !== null) {
        wcaIds.add(competition.wcaCompetitionId)
      }
    }

    const sheetSnapshotRows = (
      await Promise.all(
        [...sheetIds].map((sheetId) =>
          ctx.db
            .query("eventScheduleSnapshots")
            .withIndex("by_sheetId", (q) => q.eq("sheetId", sheetId))
            .unique()
        )
      )
    ).filter((snapshot) => snapshot !== null)

    const wcaSnapshotRows = (
      await Promise.all(
        [...wcaIds].map((wcaCompetitionId) =>
          ctx.db
            .query("wcaEventSnapshots")
            .withIndex("by_wcaCompetitionId", (q) =>
              q.eq("wcaCompetitionId", wcaCompetitionId)
            )
            .unique()
        )
      )
    ).filter((snapshot) => snapshot !== null)

    return {
      competitions,
      sheetSnapshots: sheetSnapshotRows.map(
        ({ sheetId, events, fetchedAt }) => ({ sheetId, events, fetchedAt })
      ),
      wcaSnapshots: wcaSnapshotRows.map(
        ({ wcaCompetitionId, events, fetchedAt }) => ({
          wcaCompetitionId,
          events,
          fetchedAt,
        })
      ),
    }
  },
})
