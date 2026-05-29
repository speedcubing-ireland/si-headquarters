import type { Doc } from "@/convex/_generated/dataModel"
import { phaseColor } from "@/convex/phases/validators"
import { v } from "convex/values"

export const competitionPhaseValidator = v.union(
  v.object({
    _id: v.id("phases"),
    name: v.string(),
    color: phaseColor,
  }),
  v.null()
)

export type CompetitionPhaseSnapshot = {
  _id: Doc<"phases">["_id"]
  name: string
  color: Doc<"phases">["color"]
}

export function competitionPhaseSnapshot(
  phaseDoc: Doc<"phases"> | null | undefined
): CompetitionPhaseSnapshot | null {
  if (!phaseDoc) return null
  return {
    _id: phaseDoc._id,
    name: phaseDoc.name,
    color: phaseDoc.color,
  }
}
