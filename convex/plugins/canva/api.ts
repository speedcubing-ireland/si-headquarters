"use node"

import { runCanvaAutofillJob } from "@/convex/plugins/canva/helpers"

export {
  buildCanvaDesignEditUrl,
  fetchCanvaDesignMetadata,
  parseCanvaDesignUrl,
  parseCanvaFolderInput,
} from "@/convex/plugins/canva/helpers"

export async function autofillBrandTemplate(
  accessToken: string,
  input: {
    brandTemplateId: string
    folderId: string
    competitionName: string
    outputTitle: string
  }
): Promise<{
  designId: string
  designUrl: string
  thumbnailUrl?: string
}> {
  return await runCanvaAutofillJob(accessToken, {
    brandTemplateId: input.brandTemplateId,
    title: input.outputTitle,
    competitionName: input.competitionName,
    destinationFolderId: input.folderId,
  })
}
