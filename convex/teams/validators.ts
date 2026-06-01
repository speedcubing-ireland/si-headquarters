import { v } from "convex/values"

export const teamsFields = {
  name: v.string(),
  memberIds: v.array(v.id("users")),
}
