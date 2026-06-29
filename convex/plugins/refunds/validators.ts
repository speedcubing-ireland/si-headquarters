import { defineTable } from "convex/server"
import { v } from "convex/values"

export const refundVolunteerFields = {
  name: v.string(),
  wcaId: v.optional(v.string()),
  transferToWcaIds: v.optional(v.array(v.string())),
  archived: v.boolean(),
}

export const refundsTables = {
  refundVolunteers: defineTable(refundVolunteerFields)
    .index("by_wca_id", ["wcaId"])
    .index("by_archived_name", ["archived", "name"]),
}
