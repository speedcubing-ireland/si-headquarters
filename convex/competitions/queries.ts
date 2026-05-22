import { query } from "@/convex/_generated/server"
import type { Doc } from "@/convex/_generated/dataModel"
import { getAuthUserId } from "@convex-dev/auth/server"

export const getFakeComp = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await getAuthUserId(ctx)
    const realComp = await ctx.db.query("competitions").first()
    if (!realComp) throw new Error("No competitions found in the database")

    return {
      ...realComp,
      people: {
        compLead: realComp.people.compLead ?? authUser,
        leadDelegate: realComp.people.leadDelegate ?? authUser,
        organisers: realComp.people.organisers,
      },
    } satisfies Doc<"competitions">
  },
})
