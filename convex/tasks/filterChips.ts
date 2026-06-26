import type { Doc, Id, TableNames } from "@/convex/_generated/dataModel"
import { query, type QueryCtx } from "@/convex/_generated/server"
import { requirePrincipal } from "@/convex/permissions/principal"
import { toTeamSummary } from "@/convex/teams/model"
import { teamSummary } from "@/convex/teams/validators"
import { taskLabelColorType } from "@/convex/tasks/labels/validators"
import { getPublicUsers } from "@/convex/users/queries"
import { publicUserValidator } from "@/convex/users/validators"
import { v } from "convex/values"

const filterChipLabel = v.object({
  _id: v.string(),
  name: v.string(),
})

const filterChipTaskLabel = v.object({
  _id: v.id("taskLabels"),
  code: v.string(),
  name: v.string(),
  color: taskLabelColorType,
})

/**
 * Converts the raw string ids from filter chip values into typed ids for the
 * given table, dropping any that don't reference a valid document of that table.
 */
function normalizeIds<T extends TableNames>(
  ctx: QueryCtx,
  table: T,
  ids: string[]
): Id<T>[] {
  const normalized: Id<T>[] = []
  for (const id of ids) {
    const valid = ctx.db.normalizeId(table, id)
    if (valid !== null) normalized.push(valid)
  }
  return normalized
}

/**
 * Resolves the entity ids referenced by the active task filter chips into
 * display info, so chips can show names/avatars even when the entity is not
 * present in the currently loaded board rows (e.g. the My Tasks chip when the
 * user has no matching tasks). Only the ids passed in are resolved.
 */
export const resolveEntities = query({
  args: {
    userIds: v.array(v.string()),
    teamIds: v.array(v.string()),
    labelIds: v.array(v.string()),
    competitionIds: v.array(v.string()),
    phaseIds: v.array(v.string()),
  },
  returns: v.object({
    users: v.array(publicUserValidator),
    teams: v.array(teamSummary),
    labels: v.array(filterChipTaskLabel),
    competitions: v.array(filterChipLabel),
    phases: v.array(filterChipLabel),
  }),
  handler: async (ctx, args) => {
    await requirePrincipal(ctx)

    const userIds = normalizeIds(ctx, "users", args.userIds)
    const teamIds = normalizeIds(ctx, "teams", args.teamIds)
    const labelIds = normalizeIds(ctx, "taskLabels", args.labelIds)
    const competitionIds = normalizeIds(
      ctx,
      "competitions",
      args.competitionIds
    )
    const phaseIds = normalizeIds(ctx, "phases", args.phaseIds)

    const [users, teams, labels, competitions, phases] = await Promise.all([
      getPublicUsers(ctx, userIds),
      Promise.all(teamIds.map((id) => ctx.db.get("teams", id))),
      Promise.all(labelIds.map((id) => ctx.db.get("taskLabels", id))),
      Promise.all(competitionIds.map((id) => ctx.db.get("competitions", id))),
      Promise.all(phaseIds.map((id) => ctx.db.get("phases", id))),
    ])

    return {
      users,
      teams: teams
        .filter((team): team is Doc<"teams"> => team !== null)
        .map(toTeamSummary),
      labels: labels
        .filter((label): label is Doc<"taskLabels"> => label !== null)
        .map((label) => ({
          _id: label._id,
          code: label.code,
          name: label.name,
          color: label.color,
        })),
      competitions: competitions
        .filter((comp): comp is Doc<"competitions"> => comp !== null)
        .map((comp) => ({ _id: comp._id, name: comp.name })),
      phases: phases
        .filter((phase): phase is Doc<"phases"> => phase !== null)
        .map((phase) => ({ _id: phase._id, name: phase.name })),
    }
  },
})
