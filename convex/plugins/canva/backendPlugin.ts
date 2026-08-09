import { CANVA_PRESETS } from "@/convex/plugins/canva/presets"
import {
  CANVA_ENV_KEYS,
  canvaPluginDefinition,
} from "@/convex/plugins/canva/definition"
import { runCanvaIntegration } from "@/convex/plugins/canva/runners"
import type { BackendIntegrationPlugin } from "@/convex/integrations/taskIntegrations/pluginContract"
import type { TaskNotificationEnrichmentInput } from "@/convex/notifications/types"

const canvaRunners: NonNullable<
  BackendIntegrationPlugin["taskIntegrationRunners"]
> = {}

for (const preset of CANVA_PRESETS) {
  canvaRunners[preset.id] = runCanvaIntegration
}

function enrichCanvaTaskNotification({
  draft,
  integrations,
}: TaskNotificationEnrichmentInput) {
  const design = integrations.find(
    (row) => row.output?.kind === "canva_design"
  )?.output
  if (design?.kind !== "canva_design") return draft

  const [primaryEmbed, ...restEmbeds] = draft.embeds

  return {
    ...draft,
    embeds: [
      {
        ...primaryEmbed,
        fields: [
          ...(primaryEmbed.fields ?? []),
          {
            name: ":art: Design",
            value: `[Open linked Canva design](${design.designUrl})`,
          },
        ],
      },
      ...restEmbeds,
    ],
    buttons: [
      ...draft.buttons,
      { kind: "url" as const, label: "Open Canva", url: design.designUrl },
    ],
  }
}

export const canvaPlugin = {
  ...canvaPluginDefinition,
  env: CANVA_ENV_KEYS,
  enrichTaskNotification: enrichCanvaTaskNotification,
  taskIntegrationRunners: canvaRunners,
} satisfies BackendIntegrationPlugin
