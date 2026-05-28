import { defineTable } from "convex/server"
import { v } from "convex/values"

export const pluginTables = {
  serviceTokens: defineTable({
    service: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  }).index("by_service", ["service"]),
}
