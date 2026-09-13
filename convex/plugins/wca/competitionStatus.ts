import type { WcaMilestone } from "@/convex/phases/wcaMilestones"
import { parseDateOnlyToUtcMs } from "@/convex/plugins/wca/registrationsLib"
import type {
  CompetitionIndex,
  CompetitionInfo,
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
 * The instant a refund deadline has actually passed.
 *
 * The WCA declares `refund_policy_limit_date` as a date-time but routinely
 * returns a bare date, and a refund is still allowed *on* that day — so a
 * date-only value shuts at the end of it, mirroring how `held` treats
 * `end_date`. A value carrying a time is taken at that exact instant.
 */
export function parseDeadlinePassedAt(
  value: string | undefined
): number | null {
  if (value === undefined) return null
  const trimmed = value.trim()
  const dateOnly = parseDateOnlyToUtcMs(trimmed)
  if (dateOnly !== null) return dateOnly + DAY_MS
  return parseTimestamp(trimmed)
}

/**
 * The observation with the refund deadline the detail carries folded in.
 *
 * The detail is fetched only after an observation exists — the window test that
 * decides whether it is worth fetching reads one — so this is the second half
 * of observing, not a separate fact.
 */
export function withRefundDeadline(
  observation: WcaCompetitionObservation,
  detail: CompetitionInfo
): WcaCompetitionObservation {
  return {
    ...observation,
    refundDeadlineAt: parseDeadlinePassedAt(detail.refund_policy_limit_date),
  }
}

/** Whether a deadline we know about is already behind us. */
function hasPassed(instant: number | null | undefined, nowMs: number): boolean {
  return instant !== null && instant !== undefined && instant <= nowMs
}

/** Whether a competition's end date, plus its final day, has gone by. */
function isHeldBy(endDate: string | null, nowMs: number): boolean {
  const endMs = endDate === null ? null : parseDateOnlyToUtcMs(endDate)
  return endMs !== null && nowMs >= endMs + DAY_MS
}

/**
 * Whether this competition is worth a `/v0/competitions/{id}` call to learn its
 * refund deadline. The index and `mine` carry no refund field, so the deadline
 * costs one request per competition — only competitions whose refund milestone
 * can still change earn one, keeping the rest of the run at two requests total.
 *
 * An unknown end date counts as in-window: it cannot rule the window out, and
 * guessing "over" would leave the competition permanently without a deadline.
 */
export function needsRefundDeadline(
  observation: WcaCompetitionObservation,
  storedDeadline: number | null,
  nowMs: number
): boolean {
  if (!observation.announced) return false
  if (observation.cancelled === true) return false
  // The milestone cannot un-reach, so once a stored deadline has passed there
  // is nothing left for a fetch to tell us. Without this a competition would
  // be re-fetched every hour for the weeks between its refund window shutting
  // and the competition being held.
  if (hasPassed(storedDeadline, nowMs)) return false
  return !isHeldBy(observation.endDate, nowMs)
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
    startDate: mine?.start_date ?? index?.start_date ?? null,
    endDate: mine?.end_date ?? index?.end_date ?? null,
    // Only the country index reports this, so it is null both when the
    // competition is absent from the index and when that request failed.
    registrationCloseAt: parseTimestamp(index?.registration_close),
    // Neither bulk source reports this. It is filled in by
    // `withRefundDeadline` for the competitions worth a detail request.
    refundDeadlineAt: null,
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
    ...observation,
    // Only the fields an absent source can leave unknown need a fallback; the
    // rest are whatever this run observed.
    confirmed: observation.confirmed ?? previous?.confirmed ?? false,
    cancelled: observation.cancelled ?? previous?.cancelled ?? false,
    startDate: observation.startDate ?? previous?.startDate ?? null,
    endDate: observation.endDate ?? previous?.endDate ?? null,
    registrationCloseAt:
      observation.registrationCloseAt ?? previous?.registrationCloseAt ?? null,
    refundDeadlineAt:
      observation.refundDeadlineAt ?? previous?.refundDeadlineAt ?? null,
  }
}

/**
 * Every milestone the competition has actually reached.
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
  const registrationClosed = hasPassed(status.registrationCloseAt, nowMs)
  if (registrationClosed) {
    reached.add("registrationClosed")
  }

  // Both conditions, not either: until the refund window shuts, registrations
  // can still be cancelled and refunded, so neither the competitor list nor the
  // money is settled. A deadline we have not seen holds rather than advancing —
  // nothing stalls for good, because `held` still moves the competition on.
  if (registrationClosed && hasPassed(status.refundDeadlineAt, nowMs)) {
    reached.add("refundDeadlinePassed")
  }

  // `end_date` is the competition's last day, so it is only "held" once that
  // whole day has passed — and only if the WCA announced it, so a competition
  // that never got off the ground doesn't drift into the post-competition
  // phase just because its pencilled-in date went by.
  if (status.announced && isHeldBy(status.endDate, nowMs)) {
    reached.add("held")
  }

  if (status.resultsPosted) reached.add("resultsPosted")

  return reached
}
