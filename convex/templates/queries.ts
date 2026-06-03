import { query } from "@/convex/_generated/server"
import { requireCompetitionManagement } from "@/convex/permissions/principal"
import {
  competitionTemplates,
  toCompetitionTemplateSummary,
} from "@/convex/templates/registry"
import { buildCompetitionTemplatePreview } from "@/convex/templates/resolver"
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
