import { query } from "@/convex/_generated/server"
import { requireCompetitionManagement } from "@/convex/permissions/principal"
import { competitionTemplates } from "@/convex/templates/registry"

export const listCompetitionTemplates = query({
  args: {},
  handler: async (ctx) => {
    await requireCompetitionManagement(ctx)
    return competitionTemplates.map((template) => ({
      key: template.key,
      version: template.version,
      name: template.name,
      description: template.description ?? null,
      variables: (template.variables ?? []).map((variable) => ({
        key: variable.key,
        label: variable.label,
        type: variable.type,
        required: variable.required ?? false,
        description: variable.description ?? null,
        defaultValue: variable.defaultValue ?? null,
        teamName: variable.teamName ?? null,
      })),
    }))
  },
})
