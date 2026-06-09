import type { Doc } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import {
  requireCompetitionForRead,
  requireCompetitionForUpdate,
} from "@/convex/competitions/access"
import type { Principal } from "@/convex/permissions/principal"
import {
  requireProjectForRead,
  requireProjectForUpdate,
} from "@/convex/projects/access"
import type { CompetitionOrProjectRef } from "@/convex/utils"

type DbCtx = QueryCtx | MutationCtx
export type ScopedObjectDoc = Doc<"competitions"> | Doc<"projects">

export async function requireScopedObjectForRead(
  ctx: DbCtx,
  object: CompetitionOrProjectRef
): Promise<{ principal: Principal; doc: ScopedObjectDoc }> {
  switch (object.type) {
    case "competitions": {
      const { principal, competition } = await requireCompetitionForRead(
        ctx,
        object.id
      )
      return { principal, doc: competition }
    }
    case "projects": {
      const { principal, project } = await requireProjectForRead(ctx, object.id)
      return { principal, doc: project }
    }
  }
}

export async function requireScopedObjectForUpdate(
  ctx: DbCtx,
  object: CompetitionOrProjectRef
): Promise<{ principal: Principal; doc: ScopedObjectDoc }> {
  switch (object.type) {
    case "competitions": {
      const { principal, competition } = await requireCompetitionForUpdate(
        ctx,
        object.id
      )
      return { principal, doc: competition }
    }
    case "projects": {
      const { principal, project } = await requireProjectForUpdate(
        ctx,
        object.id
      )
      return { principal, doc: project }
    }
  }
}
