import { v, type Infer } from "convex/values"
import { teamNameValidator } from "@/convex/permissions/shared"

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

export { teamNameValidator }
