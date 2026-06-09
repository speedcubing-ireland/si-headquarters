import { v } from "convex/values"
import { competitionOrProjectRef, literalUnion } from "@/convex/utils"
import { PHASE_COLORS } from "@/convex/phases/colors"

export const phaseColor = literalUnion(PHASE_COLORS)

export const phasesFields = {
  name: v.string(),
  owner: competitionOrProjectRef,
  sortKey: v.string(),
  color: phaseColor,
}
