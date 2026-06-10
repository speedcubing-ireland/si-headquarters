import { v } from "convex/values"
import { internalMutation } from "@/convex/_generated/server"
import { applyCompetitionTemplate } from "@/convex/templates/resolver"
import { templateVariablesArg } from "@/convex/templates/validators"

export const applyToExistingCompetition = internalMutation({
  args: {
    competitionId: v.id("competitions"),
    templateKey: v.string(),
    variables: templateVariablesArg,
  },
  returns: v.id("competitions"),
  handler: async (ctx, args) => {
    return await applyCompetitionTemplate(ctx, args)
  },
})
