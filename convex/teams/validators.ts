import { v, type Infer } from "convex/values"
import { TEAM_NAMES } from "@/convex/permissions/shared"

export const teamsFields = {
  name: v.string(),
}

export const teamMembershipFields = {
  teamId: v.id("teams"),
  userId: v.id("users"),
}

export const teamSummary = v.object({
  _id: v.id("teams"),
  name: v.string(),
})
export type TeamSummary = Infer<typeof teamSummary>

export const teamNameValidator = v.union(
  v.literal(TEAM_NAMES.VOLUNTEER),
  v.literal(TEAM_NAMES.DIRECTORS),
  v.literal(TEAM_NAMES.COMPETITIONS),
  v.literal(TEAM_NAMES.FINANCE),
  v.literal(TEAM_NAMES.SOCIAL_MEDIA),
  v.literal(TEAM_NAMES.MERCH),
  v.literal(TEAM_NAMES.GRAPHICS),
  v.literal(TEAM_NAMES.SOFTWARE),
  v.literal(TEAM_NAMES.DELEGATES)
)
