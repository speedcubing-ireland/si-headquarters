import { ConvexError } from "convex/values"
import { mutation } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import {
  requireProjectCreateForScope,
  requireProjectForManage,
  requireProjectForUpdate,
} from "@/convex/projects/access"
import {
  projectMemberRef,
  projectScope,
  projectStatus,
} from "@/convex/projects/validators"
import { phaseColor } from "@/convex/phases/validators"
import {
  ownerPhaseId,
  setCurrentPhaseForOwner,
} from "@/convex/phases/setCurrentPhase"
import { v } from "convex/values"
import { generateKeyBetween } from "fractional-indexing"
import { normalizeNullableText, objectRefKey } from "@/convex/utils"

const MAX_PROJECT_MEMBERS_UPDATE = 100
type ProjectMemberRef = Doc<"projectMembers">["member"]

async function hasProjectPhases(ctx: MutationCtx, projectId: Id<"projects">) {
  const phases = await ctx.db
    .query("phases")
    .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
      q.eq("owner.type", "projects").eq("owner.id", projectId)
    )
    .take(1)
  return phases.length > 0
}

async function hasProjectRootTasks(
  ctx: MutationCtx,
  projectId: Id<"projects">
) {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_root_type_and_root_id", (q) =>
      q.eq("root.type", "projects").eq("root.id", projectId)
    )
    .take(1)
  return tasks.length > 0
}

async function listProjectMembersForUpdate(
  ctx: MutationCtx,
  projectId: Id<"projects">
) {
  const members = await ctx.db
    .query("projectMembers")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
    .take(MAX_PROJECT_MEMBERS_UPDATE + 1)

  if (members.length > MAX_PROJECT_MEMBERS_UPDATE) {
    throw new Error("Project has too many members to update.")
  }

  return members
}

function uniqueMemberRefs(memberRefs: ProjectMemberRef[]) {
  return [
    ...new Map(memberRefs.map((ref) => [objectRefKey(ref), ref])).values(),
  ]
}

async function requireExistingMemberRefs(
  ctx: MutationCtx,
  memberRefs: ProjectMemberRef[]
) {
  await Promise.all(
    memberRefs.map(async (member) => {
      const doc =
        member.type === "users"
          ? await ctx.db.get("users", member.id)
          : await ctx.db.get("teams", member.id)
      if (doc === null) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message:
            member.type === "users" ? "User not found" : "Team not found",
        })
      }
    })
  )
}

export const create = mutation({
  args: {
    name: v.string(),
    description: v.nullable(v.string()),
    scope: projectScope,
    firstPhaseName: v.optional(v.string()),
    firstPhaseColor: v.optional(phaseColor),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    await requireProjectCreateForScope(ctx, args.scope)
    const name = args.name.trim()
    if (!name) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Project name is required",
      })
    }

    if (args.scope.type === "teams") {
      const team = await ctx.db.get("teams", args.scope.id)
      if (team === null) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Team not found",
        })
      }
    }

    const projectId = await ctx.db.insert("projects", {
      name,
      description: normalizeNullableText(args.description),
      scope: args.scope,
      leadUserId: null,
      phaseId: null,
      status: "planning",
    })

    const firstPhaseName = args.firstPhaseName?.trim()
    if (firstPhaseName !== undefined && firstPhaseName.length > 0) {
      const phaseId = await ctx.db.insert("phases", {
        name: firstPhaseName,
        owner: { type: "projects", id: projectId },
        sortKey: generateKeyBetween(null, null),
        color: args.firstPhaseColor ?? "gray",
      })
      await ctx.db.patch("projects", projectId, { phaseId })
    }

    return projectId
  },
})

export const setDetails = mutation({
  args: {
    id: v.id("projects"),
    name: v.string(),
    description: v.nullable(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProjectForUpdate(ctx, args.id)
    const name = args.name.trim()
    if (!name) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Project name is required",
      })
    }
    await ctx.db.patch("projects", args.id, {
      name,
      description: normalizeNullableText(args.description),
    })
    return null
  },
})

export const setLead = mutation({
  args: {
    id: v.id("projects"),
    leadUserId: v.nullable(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProjectForUpdate(ctx, args.id)
    if (args.leadUserId !== null) {
      const user = await ctx.db.get("users", args.leadUserId)
      if (user === null) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "User not found",
        })
      }
    }
    await ctx.db.patch("projects", args.id, { leadUserId: args.leadUserId })
    return null
  },
})

export const setMembers = mutation({
  args: {
    id: v.id("projects"),
    members: v.array(projectMemberRef),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProjectForUpdate(ctx, args.id)
    const nextMembers = uniqueMemberRefs(args.members)
    if (nextMembers.length > MAX_PROJECT_MEMBERS_UPDATE) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Project has too many members.",
      })
    }
    await requireExistingMemberRefs(ctx, nextMembers)

    const existing = await listProjectMembersForUpdate(ctx, args.id)

    const existingByKey = new Map(
      existing.map((row) => [objectRefKey(row.member), row])
    )
    const nextByKey = new Map(
      nextMembers.map((member) => [objectRefKey(member), member])
    )

    await Promise.all(
      existing.map((row) =>
        nextByKey.has(objectRefKey(row.member))
          ? Promise.resolve()
          : ctx.db.delete("projectMembers", row._id)
      )
    )

    await Promise.all(
      nextMembers.map((member) =>
        existingByKey.has(objectRefKey(member))
          ? Promise.resolve()
          : ctx.db.insert("projectMembers", {
              projectId: args.id,
              member,
            })
      )
    )

    return null
  },
})

export const setStatus = mutation({
  args: {
    id: v.id("projects"),
    status: projectStatus,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProjectForUpdate(ctx, args.id)
    await ctx.db.patch("projects", args.id, { status: args.status })
    return null
  },
})

export const setCurrentPhase = mutation({
  args: {
    id: v.id("projects"),
    phaseId: v.id("phases"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { principal, project } = await requireProjectForUpdate(ctx, args.id)
    await setCurrentPhaseForOwner(ctx, {
      owner: { type: "projects", id: args.id },
      phaseId: args.phaseId,
      actorId: principal.userId,
      previousPhaseId: ownerPhaseId(project),
    })
    return null
  },
})

export const deleteProject = mutation({
  args: {
    id: v.id("projects"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProjectForManage(ctx, args.id)
    if (await hasProjectPhases(ctx, args.id)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Delete all phases before deleting this project.",
      })
    }

    if (await hasProjectRootTasks(ctx, args.id)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Delete all tasks before deleting this project.",
      })
    }

    const members = await listProjectMembersForUpdate(ctx, args.id)
    await Promise.all(
      members.map((member) => ctx.db.delete("projectMembers", member._id))
    )
    await ctx.db.delete("projects", args.id)
    return null
  },
})
