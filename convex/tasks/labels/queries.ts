import { query } from "@/convex/_generated/server"
import { v } from "convex/values"
import { getTaskLabelByCode } from "./model"
import { requirePrincipal } from "@/convex/permissions/principal"

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePrincipal(ctx)
    const labels = await ctx.db.query("taskLabels").collect()
    return labels.sort((a, b) => a.name.localeCompare(b.name))
  },
})

export const getByCode = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePrincipal(ctx)
    return await getTaskLabelByCode(ctx, args.code)
  },
})
