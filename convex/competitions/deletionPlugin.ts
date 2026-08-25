import type { Doc } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import type { DeletionBudget } from "@/convex/deletion/budget"

export interface PreparedCompetitionPluginDeletion {
  execute: () => Promise<void>
}

export interface CompetitionDeletionPlugin {
  id: string
  prepareCompetitionDeletion: (
    ctx: MutationCtx,
    input: {
      budget: DeletionBudget
      competition: Doc<"competitions">
    }
  ) => Promise<PreparedCompetitionPluginDeletion>
}
