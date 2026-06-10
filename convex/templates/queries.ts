import { query } from "@/convex/_generated/server"
import { getCompetitionOrNull } from "@/convex/competitions/access"
import {
  canPerform,
  requireCompetitionManagement,
  requirePrincipal,
} from "@/convex/permissions/principal"
import {
  competitionTemplates,
  toCompetitionTemplateSummary,
} from "@/convex/templates/registry"
import { buildCompetitionTemplatePreview } from "@/convex/templates/resolver"
import { getCompetitionTemplateApplicationBlockReason } from "@/convex/templates/model"
import {
  competitionTemplatePreviewArgs,
  competitionTemplateSummary,
  templatePreview,
} from "@/convex/templates/validators"
import { v } from "convex/values"

export const listCompetitionTemplates = query({
  args: {},
  returns: v.array(competitionTemplateSummary),
  handler: async (ctx) => {
    await requireCompetitionManagement(ctx)
    return competitionTemplates.map(toCompetitionTemplateSummary)
  },
})

export const previewCompetitionTemplate = query({
  args: competitionTemplatePreviewArgs,
  returns: templatePreview,
  handler: async (ctx, args) => {
    await requireCompetitionManagement(ctx)
    return buildCompetitionTemplatePreview(args)
  },
})

export const getApplicationState = query({
  args: {
    competitionId: v.id("competitions"),
  },
  returns: v.object({
    canApply: v.boolean(),
    blockReason: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    const competition = await getCompetitionOrNull(ctx, args.competitionId)
    if (competition === null) {
      return { canApply: false, blockReason: null }
    }
    if (!canPerform(principal, "manage", "Competition", competition)) {
      return { canApply: false, blockReason: null }
    }

    const blockReason = await getCompetitionTemplateApplicationBlockReason(
      ctx,
      args.competitionId
    )
    if (blockReason !== null) {
      return { canApply: false, blockReason }
    }

    return { canApply: true, blockReason: null }
  },
})
