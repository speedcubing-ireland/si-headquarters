import type { Doc } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { getPublicUser, toPublicUser } from "@/convex/users/queries"

const MAX_PROJECT_MEMBERS_FOR_VIEW = 100

export async function hydrateProjectLead(
  ctx: QueryCtx,
  leadUserId: Doc<"projects">["leadUserId"]
) {
  return leadUserId === null ? null : await getPublicUser(ctx, leadUserId)
}

export async function hydrateProjectMembers(
  ctx: QueryCtx,
  projectId: Doc<"projects">["_id"]
) {
  const rows = await ctx.db
    .query("projectMembers")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
    .take(MAX_PROJECT_MEMBERS_FOR_VIEW + 1)

  if (rows.length > MAX_PROJECT_MEMBERS_FOR_VIEW) {
    throw new Error("Project has too many members to display.")
  }

  const members = await Promise.all(
    rows.map(async (row) => {
      if (row.member.type === "users") {
        const user = await ctx.db.get("users", row.member.id)
        return user === null
          ? null
          : ({ ...toPublicUser(user), type: "users" } as const)
      }

      const team = await ctx.db.get("teams", row.member.id)
      return team === null
        ? null
        : ({ _id: team._id, name: team.name, type: "teams" } as const)
    })
  )

  type MemberView = NonNullable<(typeof members)[number]>

  return members
    .filter((member): member is MemberView => member !== null)
    .sort((left, right) =>
      (left.name ?? "Unknown").localeCompare(right.name ?? "Unknown")
    )
}

export type ProjectMemberView = Awaited<
  ReturnType<typeof hydrateProjectMembers>
>[number]

export async function hydrateProjectCard(
  ctx: QueryCtx,
  project: Doc<"projects">
) {
  const phase =
    project.phaseId === null
      ? null
      : await ctx.db.get("phases", project.phaseId)

  return {
    _id: project._id,
    name: project.name,
    description: project.description,
    status: project.status,
    leadUserId: project.leadUserId,
    phaseId: project.phaseId,
    phaseName: phase?.name ?? null,
    phaseColor: phase?.color ?? null,
  }
}

export type ProjectCardSummary = Awaited<ReturnType<typeof hydrateProjectCard>>
