import { mutation } from "@/convex/_generated/server"
import { requireTaskManagement } from "@/convex/permissions/principal"
import { ensureDefaultTaskLabels } from "./model"

export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireTaskManagement(ctx)
    await ensureDefaultTaskLabels(ctx)
  },
})
