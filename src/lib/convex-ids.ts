import type { Id, TableNames } from "@/convex/_generated/dataModel"

const isId = <T extends TableNames>(v: string): v is Id<T> =>
  typeof v === "string" && v.length > 0

const parser =
  <T extends TableNames>() =>
  (v: string) =>
    isId<T>(v) ? v : null

const requirer =
  <T extends TableNames>(t: T) =>
  (v: string) => {
    if (isId<T>(v)) return v
    throw new Error(`${t} ID required`)
  }

export const parseTaskId = parser<"tasks">()
export const requireTaskId = requirer("tasks")

export const parseCompetitionId = parser<"competitions">()
export const requireCompetitionId = requirer("competitions")

export const parseTeamId = parser<"teams">()
export const requireTeamId = requirer("teams")

export const parseSponsorshipAuctionId = parser<"sponsorshipAuctions">()
export const requireSponsorshipAuctionId = requirer("sponsorshipAuctions")
