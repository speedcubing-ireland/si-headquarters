import { v } from "convex/values"
import { PROJECT_STATUSES } from "@/convex/projects/statuses"
import { objectRef } from "@/convex/utils"

export const projectStatus = v.union(
  ...PROJECT_STATUSES.map((status) => v.literal(status))
)

export const projectScope = v.union(
  v.object({ type: v.literal("global") }),
  v.object({ type: v.literal("teams"), id: v.id("teams") })
)

export const projectMemberRef = v.union(objectRef("users"), objectRef("teams"))

export const projectsFields = {
  name: v.string(),
  description: v.nullable(v.string()),
  scope: projectScope,
  leadUserId: v.nullable(v.id("users")),
  phaseId: v.nullable(v.id("phases")),
  status: projectStatus,
}

export const projectMemberFields = {
  projectId: v.id("projects"),
  member: projectMemberRef,
}
