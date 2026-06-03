import { mutation } from "@/convex/_generated/server"
import { requireTaskManagement } from "@/convex/permissions/principal"
import { ensureDefaultTaskLabels } from "./model"

/** Seeds canonical task labels from {@link DEFAULT_TASK_LABELS}. */
export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireTaskManagement(ctx)
    await ensureDefaultTaskLabels(ctx)
  },
})
