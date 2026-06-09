import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import { throwNotFound } from "@/convex/errors"
import {
  requireCan,
  requirePrincipal,
  type Principal,
} from "@/convex/permissions/principal"
import type { Action } from "@/convex/permissions/shared"

type DbCtx = QueryCtx | MutationCtx

export async function getCompetitionOrNull(
  ctx: DbCtx,
  id: Id<"competitions">
): Promise<Doc<"competitions"> | null> {
  return await ctx.db.get("competitions", id)
}

async function requireCompetitionForAction(
  ctx: DbCtx,
  id: Id<"competitions">,
  action: Action
): Promise<{ principal: Principal; competition: Doc<"competitions"> }> {
  const principal = await requirePrincipal(ctx)
  const competition = await getCompetitionOrNull(ctx, id)
  if (competition === null) {
    throwNotFound("Competition not found")
  }
  requireCan(principal, action, "Competition", competition)
  return { principal, competition }
}

export async function requireCompetitionForRead(
  ctx: DbCtx,
  id: Id<"competitions">
): Promise<{ principal: Principal; competition: Doc<"competitions"> }> {
  return await requireCompetitionForAction(ctx, id, "read")
}

export async function requireCompetitionForUpdate(
  ctx: DbCtx,
  id: Id<"competitions">
): Promise<{ principal: Principal; competition: Doc<"competitions"> }> {
  return await requireCompetitionForAction(ctx, id, "update")
}

export async function requireCompetitionForManage(
  ctx: DbCtx,
  id: Id<"competitions">
): Promise<{ principal: Principal; competition: Doc<"competitions"> }> {
  return await requireCompetitionForAction(ctx, id, "manage")
}
