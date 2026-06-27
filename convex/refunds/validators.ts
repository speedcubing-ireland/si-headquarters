import { v } from "convex/values"

export const refundVolunteerFields = {
  name: v.string(),
  wcaId: v.optional(v.string()),
  transferToWcaIds: v.optional(v.array(v.string())),
  archived: v.boolean(),
}
