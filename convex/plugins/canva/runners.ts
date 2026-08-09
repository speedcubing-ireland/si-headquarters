"use node"

import type { ActionCtx } from "@/convex/_generated/server"
import { resolveValidServiceToken } from "@/convex/integrations/tokens"
import type {
  TaskIntegrationRunContext,
  TaskIntegrationRunResult,
} from "@/convex/integrations/taskIntegrations/pluginContract"
import { autofillBrandTemplate } from "@/convex/plugins/canva/api"
import {
  buildCanvaOutputTitle,
  getCanvaPreset,
  resolveCanvaPresetEnv,
  type CanvaPreset,
} from "@/convex/plugins/canva/presets"

async function runCanvaAutofill(
  ctx: ActionCtx,
  run: TaskIntegrationRunContext,
  preset: CanvaPreset
): Promise<TaskIntegrationRunResult> {
  const { sourceBrandTemplateId, destinationFolderId } =
    resolveCanvaPresetEnv(preset)

  const accessToken = await resolveValidServiceToken(ctx, "canva")

  const design = await autofillBrandTemplate(accessToken, {
    brandTemplateId: sourceBrandTemplateId,
    folderId: destinationFolderId,
    competitionName: run.competitionName,
    outputTitle: buildCanvaOutputTitle(run.competitionName, preset),
  })
  return {
    status: "awaiting_manual_share",
    lastMessage: null,
    output: {
      kind: "canva_design",
      designId: design.designId,
      designUrl: design.designUrl,
    },
  }
}

export async function runCanvaIntegration(
  ctx: ActionCtx,
  run: TaskIntegrationRunContext
): Promise<TaskIntegrationRunResult> {
  const preset = getCanvaPreset(run.integrationId)
  return runCanvaAutofill(ctx, run, preset)
}
