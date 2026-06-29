import type { QueryCtx } from "@/convex/_generated/server"
import { internalQuery } from "@/convex/_generated/server"
import { competitionPrimaryStart } from "@/convex/competitions/dates"
import { MAX_EVENT_REPORT_SOURCES } from "@/convex/events/constants"
import { DEFAULT_RESOURCE_KEYS } from "@/convex/integrations/constants"
import { requireEventsDashboardAccess } from "@/convex/permissions/principal"
import {
  eventReportSourceValidator,
  eventScheduleSnapshotValidator,
  type EventReportSource,
} from "@/convex/events/validators"
import { isFeatureEnabled } from "@/config/lib/organisation"
import { ConvexError, v } from "convex/values"

interface LinkedCompetitionSheet {
  competitionId: EventReportSource["competitionId"]
  sheet: EventReportSource["sheet"]
}

function assertWithinSourceLimit(count: number): void {
  if (count > MAX_EVENT_REPORT_SOURCES) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `The events report supports at most ${String(MAX_EVENT_REPORT_SOURCES)} linked competition sheets.`,
    })
  }
}

async function loadReportSources(ctx: QueryCtx): Promise<EventReportSource[]> {
  if (!isFeatureEnabled("events")) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Events are not enabled for this organisation.",
    })
  }
  await requireEventsDashboardAccess(ctx)

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

  const competitionIds = new Set<string>()
  const linkedSheets: LinkedCompetitionSheet[] = []
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
    if (competitionIds.has(resource.object.id)) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Competition ${resource.object.id} has multiple default Google Sheet resources.`,
      })
    }
    competitionIds.add(resource.object.id)
    linkedSheets.push({
      competitionId: resource.object.id,
      sheet: {
        sheetId: resource.data.sheetId,
        title: resource.data.title,
        url: resource.data.url,
      },
    })
  }

  const sources = (
    await Promise.all(
      linkedSheets.map(
        async ({ competitionId, sheet }): Promise<EventReportSource | null> => {
          const competition = await ctx.db.get("competitions", competitionId)
          if (competition === null) {
            return null
          }
          const wcaCompetitionId = competition.wcaCompetitionId ?? null

          return {
            competitionId,
            competitionName: competition.name,
            dates: competition.compDates,
            sheet,
            wcaCompetition:
              wcaCompetitionId === null
                ? null
                : {
                    id: wcaCompetitionId,
                    url: null,
                  },
          }
        }
      )
    )
  ).filter((source): source is EventReportSource => source !== null)

  return sources.sort((left, right) => {
    const leftDate = competitionPrimaryStart(left.dates) ?? "9999-12-31"
    const rightDate = competitionPrimaryStart(right.dates) ?? "9999-12-31"
    return (
      leftDate.localeCompare(rightDate) ||
      left.competitionName.localeCompare(right.competitionName)
    )
  })
}

export const listReportSources = internalQuery({
  args: {},
  returns: v.array(eventReportSourceValidator),
  handler: loadReportSources,
})

export const loadReportContext = internalQuery({
  args: {},
  returns: v.object({
    sources: v.array(eventReportSourceValidator),
    snapshots: v.array(eventScheduleSnapshotValidator),
  }),
  handler: async (ctx) => {
    const sources = await loadReportSources(ctx)
    const sheetIds = new Set(sources.map((source) => source.sheet.sheetId))
    const snapshotRows = (
      await Promise.all(
        [...sheetIds].map((sheetId) =>
          ctx.db
            .query("eventScheduleSnapshots")
            .withIndex("by_sheetId", (q) => q.eq("sheetId", sheetId))
            .unique()
        )
      )
    ).filter((snapshot) => snapshot !== null)
    const snapshots = snapshotRows.map(({ sheetId, events, fetchedAt }) => ({
      sheetId,
      events,
      fetchedAt,
    }))

    return { sources, snapshots }
  },
})
