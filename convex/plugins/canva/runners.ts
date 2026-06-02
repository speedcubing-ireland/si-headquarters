"use node"

import { internal } from "@/convex/_generated/api"
import type { ActionCtx } from "@/convex/_generated/server"
import type {
  IntegrationRunResult,
  RunContext,
} from "@/convex/plugins/core/integrationTypes"
import { autofillBrandTemplate } from "@/convex/plugins/canva/api"
import {
  buildCanvaOutputTitle,
  getCanvaPreset,
  resolveCanvaPresetEnv,
  type CanvaPreset,
} from "@/convex/plugins/canva/presets"

async function runCanvaAutofill(
  ctx: ActionCtx,
  run: RunContext,
  preset: CanvaPreset
): Promise<IntegrationRunResult> {
  const { sourceBrandTemplateId, destinationFolderId } =
    resolveCanvaPresetEnv(preset)

  const accessToken = await ctx.runAction(
    internal.plugins.core.tokens.getValidServiceToken,
    { service: "canva" }
  )

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
      thumbnailUrl: design.thumbnailUrl,
    },
  }
}

export async function runCanvaIntegration(
  ctx: ActionCtx,
  run: RunContext
): Promise<IntegrationRunResult> {
  const preset = getCanvaPreset(run.integrationId)
  return runCanvaAutofill(ctx, run, preset)
}
