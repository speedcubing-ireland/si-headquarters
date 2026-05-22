import { query } from "@/convex/_generated/server"
import type { Doc } from "@/convex/_generated/dataModel"

export const getFakeComp = query({
  args: {},
  handler: async (ctx) => {
    const realComp = await ctx.db.query("competitions").first()
    if (!realComp) throw new Error("No competitions found in the database")

    const competition = {
      ...realComp,
      updateId: realComp.updateId ?? null,
    } satisfies Doc<"competitions">

    return competition
  },
})
