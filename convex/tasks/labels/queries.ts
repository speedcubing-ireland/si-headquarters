import { query } from "@/convex/_generated/server"

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("taskLabels").collect()
  },
})
