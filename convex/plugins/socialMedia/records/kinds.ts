// Plain constants, so the frontend can share them without the table definitions.

/** The record tags WCA Live reports, in display order. */
export const RECORD_TAGS = ["NR", "CR", "WR"] as const

export type RecordTag = (typeof RECORD_TAGS)[number]

/**
 * The tag for a WCA record marker: "NR", "WR", or a continental code such as
 * "ER", which WCA Live calls a CR.
 */
export function recordTag(marker: string): RecordTag {
  if (marker === "NR" || marker === "WR") return marker
  return "CR"
}

export const RECORD_TYPES = ["single", "average"] as const

/**
 * Where a record stands: as WCA Live entered it, confirmed by the WCA's posted
 * results, or dropped by them.
 */
export const RECORD_STATUSES = ["live", "confirmed", "notRecord"] as const
