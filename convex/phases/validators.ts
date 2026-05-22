import { v } from "convex/values"

export const PHASE_COLORS = ["gray", "red", "sky", "amber", "green"] as const

export const phaseOwnerRef = v.union(
  ...(["competitions"] as const).map((tableName) =>
    v.object({
      type: v.literal(tableName),
      id: v.id(tableName),
    })
  )
)

export const phaseColor = v.union(
  ...PHASE_COLORS.map((color) => v.literal(color))
)

export const phasesFields = {
  name: v.string(),
  owner: phaseOwnerRef,
  sortKey: v.string(),
  color: phaseColor,
}
