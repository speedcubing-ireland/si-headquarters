import {
  WCA_MILESTONES,
  type WcaMilestone,
} from "@/convex/phases/wcaMilestones"
import { parseDateOnlyToUtcMs } from "@/convex/plugins/wca/registrationsLib"
import type {
  CompetitionIndex,
  MyCompetition,
} from "@/convex/plugins/wca/openapiClient/types.gen"
import type {
  WcaCompetitionObservation,
  WcaCompetitionStatus,
} from "@/convex/plugins/wca/validators"

/**
 * The WCA exposes no single competition "status". These helpers turn the flags
 * and dates it does return into the milestone ladder the phase sync works
 * against. Kept pure and free of Convex context so they can be unit-tested
 * directly.
 */

const DAY_MS = 24 * 60 * 60 * 1000

function parseTimestamp(value: string | undefined): number | null {
  if (value === undefined) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const parsed = Date.parse(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * What the two WCA sources say about a competition this run.
 *
 * `/v0/competitions/mine` is the primary source: it is the only one that sees a
 * competition before it is announced, so its flags win where both have an
 * opinion. `/v0/competition_index` fills in `registration_close`, which
 * `MyCompetition` does not carry, and covers announced competitions the service
 * account is not personally delegating or organising. Appearing in the index at
 * all means the WCA has announced the competition.
 *
 * Facts a source could not supply come back `null` rather than `false`. That
 * distinction matters: the index includes cancelled competitions but carries no
 * cancellation field, so asserting `cancelled: false` from the index alone would
 * "reinstate" a competition the WCA still has cancelled.
 */
export function observeCompetition(args: {
  wcaCompetitionId: string
  mine: MyCompetition | undefined
  index: CompetitionIndex | undefined
  fetchedAt: number
}): WcaCompetitionObservation {
  const { mine, index } = args

  return {
    wcaCompetitionId: args.wcaCompetitionId,
    // Only `mine` reports these two.
    confirmed: mine?.["confirmed?"] ?? null,
    cancelled: mine?.["cancelled?"] ?? null,
    announced: mine?.["visible?"] ?? index !== undefined,
    resultsPosted:
      mine?.["results_posted?"] ?? index?.results_posted_at !== undefined,
    reportPosted:
      mine?.["report_posted?"] ?? index?.report_posted_at !== undefined,
    startDate: mine?.start_date ?? index?.start_date ?? null,
    endDate: mine?.end_date ?? index?.end_date ?? null,
    // Only the country index reports this, so it is null both when the
    // competition is absent from the index and when that request failed.
    registrationCloseAt: parseTimestamp(index?.registration_close),
    fetchedAt: args.fetchedAt,
  }
}

/**
 * Folds an observation onto what we already knew, so a fact this run could not
 * determine is carried forward rather than overwritten with a guess. Without
 * this, one sync that could not reach a source would silently drop a
 * cancellation or a registration close date.
 */
export function mergeObservation(
  previous: WcaCompetitionStatus | null,
  observation: WcaCompetitionObservation
): WcaCompetitionStatus {
  return {
    wcaCompetitionId: observation.wcaCompetitionId,
    confirmed: observation.confirmed ?? previous?.confirmed ?? false,
    cancelled: observation.cancelled ?? previous?.cancelled ?? false,
    announced: observation.announced,
    resultsPosted: observation.resultsPosted,
    reportPosted: observation.reportPosted,
    startDate: observation.startDate ?? previous?.startDate ?? null,
    endDate: observation.endDate ?? previous?.endDate ?? null,
    registrationCloseAt:
      observation.registrationCloseAt ?? previous?.registrationCloseAt ?? null,
    fetchedAt: observation.fetchedAt,
  }
}

/**
 * Every milestone the competition has actually reached, in ladder order.
 *
 * Gaps are left as gaps rather than being filled in from a later milestone: the
 * WCA genuinely does report results for a competition whose registration-close
 * date we never saw, and claiming it "reached" that milestone would misreport
 * the competition's state on the competition page. Nothing downstream needs the
 * gaps filled — the phase sync takes the *furthest* unlocked phase, and the
 * mapping is validated to keep later milestones on later phases.
 */
export function reachedMilestones(
  status: WcaCompetitionStatus,
  nowMs: number
): Set<WcaMilestone> {
  const reached = new Set<WcaMilestone>()

  // A status row only exists for a competition we found on the WCA at all.
  reached.add("submitted")
  if (status.confirmed) reached.add("confirmed")
  if (status.announced) reached.add("announced")
  if (
    status.registrationCloseAt !== null &&
    status.registrationCloseAt <= nowMs
  ) {
    reached.add("registrationClosed")
  }

  // `end_date` is the competition's last day, so it is only "held" once that
  // whole day has passed — and only if the WCA announced it, so a competition
  // that never got off the ground doesn't drift into the post-competition
  // phase just because its pencilled-in date went by.
  const endMs =
    status.endDate === null ? null : parseDateOnlyToUtcMs(status.endDate)
  if (status.announced && endMs !== null && nowMs >= endMs + DAY_MS) {
    reached.add("held")
  }

  if (status.resultsPosted) reached.add("resultsPosted")

  return new Set(WCA_MILESTONES.filter((milestone) => reached.has(milestone)))
}
