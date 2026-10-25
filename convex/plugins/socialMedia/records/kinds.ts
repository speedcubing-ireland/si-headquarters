// Plain constants, so the frontend can share them without the table definitions.

/** The record tags WCA Live reports, in display order. */
export const RECORD_TAGS = ["NR", "CR", "WR"] as const

export const RECORD_TYPES = ["single", "average"] as const

/**
 * Where a record stands: as WCA Live entered it, confirmed by the WCA's posted
 * results, or dropped by them.
 */
export const RECORD_STATUSES = ["live", "confirmed", "notRecord"] as const
