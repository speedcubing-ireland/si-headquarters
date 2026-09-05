import {
  WCA_MILESTONES,
  type WcaMilestone,
} from "@/convex/phases/wcaMilestones"
import { parseDateOnlyToUtcMs } from "@/convex/plugins/wca/registrationsLib"
import type {
  CompetitionIndex,
  MyCompetition,
} from "@/convex/plugins/wca/openapiClient/types.gen"
import type { WcaCompetitionStatus } from "@/convex/plugins/wca/validators"

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
 * Merges the two WCA sources into one status.
 *
 * `/v0/competitions/mine` is the primary source: it is the only one that sees a
 * competition before it is announced, so its flags win where both have an
 * opinion. `/v0/competition_index` fills in `registration_close`, which
 * `MyCompetition` does not carry, and covers announced competitions the service
 * account is not personally delegating or organising. Appearing in the index at
 * all means the WCA has announced the competition.
 */
export function toCompetitionStatus(args: {
  wcaCompetitionId: string
  mine: MyCompetition | undefined
  index: CompetitionIndex | undefined
  fetchedAt: number
}): WcaCompetitionStatus {
  const { mine, index } = args

  return {
    wcaCompetitionId: args.wcaCompetitionId,
    confirmed: mine?.["confirmed?"] ?? false,
    announced: mine?.["visible?"] ?? index !== undefined,
    cancelled: mine?.["cancelled?"] ?? false,
    resultsPosted:
      mine?.["results_posted?"] ?? index?.results_posted_at !== undefined,
    reportPosted:
      mine?.["report_posted?"] ?? index?.report_posted_at !== undefined,
    startDate: mine?.start_date ?? index?.start_date ?? null,
    endDate: mine?.end_date ?? index?.end_date ?? null,
    registrationCloseAt: parseTimestamp(index?.registration_close),
    fetchedAt: args.fetchedAt,
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
