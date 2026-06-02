import { query } from "@/convex/_generated/server"
import { v } from "convex/values"
import { getTaskLabelByCode } from "./model"

export const list = query({
  args: {},
  handler: async (ctx) => {
    const labels = await ctx.db.query("taskLabels").collect()
    return labels.sort((a, b) => a.name.localeCompare(b.name))
  },
})

export const getByCode = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    return await getTaskLabelByCode(ctx, args.code)
  },
})
