import { defineTable } from "convex/server"
import { v } from "convex/values"
import {
  objectLinkedResourceFields,
  oauthService,
} from "@/convex/integrations/validators"
import {
  projectWorkflowFields,
  projectWorkflowRunFields,
} from "@/convex/projectWorkflows/validators"
import {
  taskIntegrationId,
  taskIntegrationOutput,
  taskIntegrationStatus,
} from "@/convex/integrations/taskIntegrations/validators"

export const oauthPluginTables = {
  serviceTokens: defineTable({
    service: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    // All three are optional so rows written before this existed — and rows
    // written by `bun run auth`, which has no signed-in user — keep validating.
    scope: v.optional(v.string()),
    connectedByUserId: v.optional(v.id("users")),
    connectedAt: v.optional(v.number()),
  }).index("by_service", ["service"]),
  // Short-lived, single-use OAuth authorization attempts started from the admin
  // page. Only the hash of the state is stored, matching how
  // `impersonationSessions` and `competitionOrganiserInvites` handle tokens that
  // round-trip through a browser URL. The code verifier must be plaintext
  // because the token exchange needs it — it never leaves Convex.
  serviceOAuthAttempts: defineTable({
    stateHash: v.string(),
    service: oauthService,
    codeVerifier: v.optional(v.string()),
    createdByUserId: v.id("users"),
    expiresAt: v.number(),
  })
    .index("by_stateHash", ["stateHash"])
    .index("by_createdByUserId", ["createdByUserId"])
    .index("by_expiresAt", ["expiresAt"]),
}

export const integrationPluginTables = {
  objectLinkedResources: defineTable(objectLinkedResourceFields)
    .index("by_object_type_and_object_id", ["object.type", "object.id"])
    .index("by_object_type_and_object_id_and_resourceType", [
      "object.type",
      "object.id",
      "resourceType",
    ])
    .index("by_object_type_and_object_id_and_resourceType_and_resourceKey", [
      "object.type",
      "object.id",
      "resourceType",
      "resourceKey",
    ])
    .index("by_object_type_and_resourceType_and_resourceKey_and_object_id", [
      "object.type",
      "resourceType",
      "resourceKey",
      "object.id",
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

export const projectWorkflowTables = {
  projectWorkflows: defineTable(projectWorkflowFields)
    .index("by_projectId", ["projectId"])
    .index("by_projectId_and_workflowId", ["projectId", "workflowId"])
    .index("by_workflowId_and_enabled", ["workflowId", "enabled"]),
  workflowRuns: defineTable(projectWorkflowRunFields)
    .index("by_projectWorkflowId", ["projectWorkflowId"])
    .index("by_projectWorkflowId_and_queuedAt", [
      "projectWorkflowId",
      "queuedAt",
    ])
    .index("by_status", ["status"]),
}
