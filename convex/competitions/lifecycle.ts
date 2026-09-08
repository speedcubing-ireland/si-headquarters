import type { Doc } from "@/convex/_generated/dataModel"

/**
 * Whether the WCA has cancelled this competition.
 *
 * The single definition of "is this competition still live work?". Every reader
 * that filters cancelled competitions out — the home dashboard, the overdue
 * scan — goes through this rather than re-spelling the field test, so a change
 * to how cancellation is recorded has one place to land.
 *
 * The calendar deliberately still *shows* cancelled competitions, struck
 * through, which is why this is a predicate rather than a filtered query.
 */
export function isCompetitionCancelled(
  competition: Pick<Doc<"competitions">, "cancelledAt">
): boolean {
  return competition.cancelledAt !== undefined
}
