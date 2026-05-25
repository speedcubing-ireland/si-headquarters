import { v } from "convex/values"
import { objectRef } from "@/convex/utils"

export const PHASE_COLORS = ["gray", "red", "sky", "amber", "green"] as const

export const phaseOwnerRef = objectRef("competitions")

export const phaseColor = v.union(
  ...PHASE_COLORS.map((color) => v.literal(color))
)

export const phasesFields = {
  name: v.string(),
  owner: phaseOwnerRef,
  sortKey: v.string(),
  color: phaseColor,
}
