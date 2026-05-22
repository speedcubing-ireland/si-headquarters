import { v } from "convex/values"

export const PHASE_OWNER_TABLE_NAMES = ["competitions"] as const

export const PHASE_COLORS = ["gray", "red", "sky", "amber", "green"] as const

export const phaseOwnerType = v.union(
  ...PHASE_OWNER_TABLE_NAMES.map((tableName) => v.literal(tableName))
)

export const phaseOwnerId = v.union(
  ...PHASE_OWNER_TABLE_NAMES.map((tableName) => v.id(tableName))
)

export const phaseColor = v.union(
  ...PHASE_COLORS.map((color) => v.literal(color))
)

export const phasesFields = {
  name: v.string(),
  ownerType: phaseOwnerType,
  ownerId: phaseOwnerId,
  sortKey: v.string(),
  color: phaseColor,
}
