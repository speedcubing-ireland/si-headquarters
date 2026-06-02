import { defineTable } from "convex/server"
import { v } from "convex/values"
import {
  competitionResourceData,
  competitionResourceType,
  taskIntegrationId,
  taskIntegrationOutput,
  taskIntegrationStatus,
} from "@/convex/plugins/core/validators"

export const oauthPluginTables = {
  serviceTokens: defineTable({
    service: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  }).index("by_service", ["service"]),
}

export const integrationPluginTables = {
  competitionLinkedResources: defineTable({
    competitionId: v.id("competitions"),
    resourceType: competitionResourceType,
    resourceKey: v.string(),
    data: competitionResourceData,
  })
    .index("by_competitionId_and_resourceType", [
      "competitionId",
      "resourceType",
    ])
    .index("by_competitionId_and_resourceType_and_resourceKey", [
      "competitionId",
      "resourceType",
      "resourceKey",
    ]),
  taskIntegrations: defineTable({
    taskId: v.id("tasks"),
    integrationId: taskIntegrationId,
    status: taskIntegrationStatus,
    lastMessage: v.union(v.string(), v.null()),
    lastRunAt: v.union(v.number(), v.null()),
    runId: v.union(v.string(), v.null()),
    output: taskIntegrationOutput,
  })
    .index("by_taskId", ["taskId"])
    .index("by_taskId_and_integrationId", ["taskId", "integrationId"]),
}
