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

export interface CompetitionPhaseSnapshot {
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

export const competitionPhaseProgressValidator = v.object({
  total: v.number(),
  done: v.number(),
  cancelled: v.number(),
  incomplete: v.number(),
  inProgress: v.number(),
  blocked: v.number(),
  completionPercent: v.number(),
})

export const currentPhaseProgressValidator = v.object({
  phase: competitionPhaseValidator,
  progress: competitionPhaseProgressValidator,
})

export const NO_CURRENT_PHASE_PROGRESS = {
  phase: null,
  progress: {
    total: 0,
    done: 0,
    cancelled: 0,
    incomplete: 0,
    inProgress: 0,
    blocked: 0,
    completionPercent: 0,
  },
} as const
