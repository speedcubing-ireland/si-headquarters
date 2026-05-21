import { ConvexError, v } from "convex/values"
import { action, type ActionCtx } from "../../_generated/server"
import { requireVolunteerAction } from "../../lib/oauth"
import { createCanvaClient } from "./apiClient"
import {
  createDesignAutofillJob,
  getBrandTemplateDataset,
  getDesign,
  getDesignAutofillJob,
  getFolder,
  listBrandTemplates as listBrandTemplatesApi,
  listFolderItems as listFolderItemsApi,
  moveFolderItem,
} from "./client/sdk.gen"
import {
  buildCanvaAutofillData,
  buildCanvaDesignEditUrl,
  mapBrandTemplatePickerItems,
  parseCanvaDesignInput,
  parseCanvaFolderInput,
} from "./lib/helpers"
import { getServiceAccessToken } from "../tokens/runtime"
import { applyResourcePrefix } from "../../lib/deploymentGuard"

function canvaError(
  err:
    | {
        message?: string
        error?: string
        error_description?: string
        code?: string
      }
    | undefined
): string {
  return (
    err?.message ??
    err?.error_description ??
    err?.error ??
    err?.code ??
    "Unknown Canva API error"
  )
}

async function requireCanvaAccess(ctx: ActionCtx) {
  await requireVolunteerAction(ctx)
}

async function getCanvaClient(ctx: ActionCtx) {
  const accessToken = await getServiceAccessToken(ctx, "canva")
  if (!accessToken) {
    throw new ConvexError({
      code: "PRECONDITION_FAILED",
      message: "No Canva token. Run bun run auth canva from repo root.",
    })
  }
  return createCanvaClient(accessToken)
}

async function requireCanvaClient(ctx: ActionCtx) {
  await requireCanvaAccess(ctx)
  return await getCanvaClient(ctx)
}

export const listBrandTemplates = action({
  args: {
    query: v.optional(v.string()),
    continuation: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    items: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        url: v.union(v.string(), v.null()),
      })
    ),
    continuation: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const client = await requireCanvaClient(ctx)
    const r = await listBrandTemplatesApi({
      client,
      query: {
        query: args.query,
        continuation: args.continuation,
        limit: args.limit,
        dataset: "non_empty",
      },
    })
    if (r.error) throw new Error(`Canva list templates: ${canvaError(r.error)}`)
    const data = r.data
    const items = mapBrandTemplatePickerItems(data)
    return {
      items,
      continuation: data.continuation ?? null,
    }
  },
})

export const listFolderItems = action({
  args: {
    folderId: v.optional(v.string()),
    continuation: v.optional(v.string()),
    limit: v.optional(v.number()),
    itemTypes: v.optional(
      v.array(
        v.union(v.literal("folder"), v.literal("design"), v.literal("image"))
      )
    ),
    sortBy: v.optional(
      v.union(
        v.literal("created_ascending"),
        v.literal("created_descending"),
        v.literal("modified_ascending"),
        v.literal("modified_descending"),
        v.literal("title_ascending"),
        v.literal("title_descending")
      )
    ),
  },
  returns: v.object({
    items: v.array(
      v.object({
        type: v.union(
          v.literal("folder"),
          v.literal("design"),
          v.literal("image")
        ),
        id: v.string(),
        name: v.string(),
      })
    ),
    continuation: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const client = await requireCanvaClient(ctx)
    const r = await listFolderItemsApi({
      client,
      path: { folderId: args.folderId ?? "root" },
      query: {
        continuation: args.continuation,
        limit: args.limit,
        item_types: args.itemTypes,
        sort_by: args.sortBy,
      },
    })
    if (r.error)
      throw new Error(`Canva list folder items: ${canvaError(r.error)}`)
    const data = r.data
    const items = (data.items ?? [])
      .map((item) => {
        if (item.type === "folder" && item.folder) {
          return {
            type: "folder" as const,
            id: item.folder.id,
            name: item.folder.name ?? item.folder.id,
          }
        }
        if (item.type === "design" && item.design) {
          return {
            type: "design" as const,
            id: item.design.id,
            name: item.design.title ?? item.design.id,
          }
        }
        if (item.type === "image" && item.image) {
          return {
            type: "image" as const,
            id: item.image.id,
            name: item.image.name ?? item.image.id,
          }
        }
        return null
      })
      .filter(
        (
          item
        ): item is {
          type: "folder" | "design" | "image"
          id: string
          name: string
        } => item !== null
      )

    return {
      items,
      continuation: data.continuation ?? null,
    }
  },
})

export const validateFolderInput = action({
  args: {
    value: v.string(),
  },
  returns: v.object({
    id: v.string(),
    name: v.string(),
    path: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireCanvaAccess(ctx)
    const folderId = parseCanvaFolderInput(args.value)
    if (folderId === "root") {
      return {
        id: "root",
        name: "Root",
        path: "Root",
      }
    }

    const client = await getCanvaClient(ctx)
    try {
      const r = await getFolder({ client, path: { folderId } })
      if (r.error) throw new Error(`Canva get folder: ${canvaError(r.error)}`)
      const name = r.data.folder?.name ?? folderId
      return {
        id: folderId,
        name,
        path: name,
      }
    } catch (error) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          error instanceof Error
            ? error.message
            : "Could not validate Canva folder.",
      })
    }
  },
})

export const validateDesignInput = action({
  args: {
    value: v.string(),
  },
  returns: v.object({
    id: v.string(),
    title: v.string(),
    url: v.string(),
    previewImageUrl: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireCanvaAccess(ctx)
    const designId = parseCanvaDesignInput(args.value)
    const client = await getCanvaClient(ctx)
    const r = await getDesign({ client, path: { designId } })
    if (r.error) throw new Error(`Canva get design: ${canvaError(r.error)}`)
    const design = r.data.design
    if (!design) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Canva design not found.",
      })
    }
    const designUrl = buildCanvaDesignEditUrl(designId)

    return {
      id: designId,
      title: design.title ?? designId,
      url: designUrl,
      previewImageUrl: design.thumbnail?.url ?? null,
    }
  },
})

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const runTemplateAction = action({
  args: {
    sourceBrandTemplateId: v.string(),
    destinationFolderId: v.string(),
    outputTitle: v.string(),
    competitionName: v.optional(v.string()),
  },
  returns: v.object({
    designId: v.string(),
    title: v.string(),
    url: v.union(v.string(), v.null()),
    previewImageUrl: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const client = await requireCanvaClient(ctx)
    const dr = await getBrandTemplateDataset({
      client,
      path: { brandTemplateId: args.sourceBrandTemplateId },
    })
    if (dr.error) throw new Error(`Canva get dataset: ${canvaError(dr.error)}`)
    const dataset = dr.data
    const hasAutofillFields = Boolean(
      dataset.dataset && Object.keys(dataset.dataset).length > 0
    )
    if (!hasAutofillFields) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "Selected Canva template has no autofill-capable fields. Choose a template configured for autofill.",
      })
    }

    const autofillData = buildCanvaAutofillData(
      dataset.dataset,
      args.competitionName ?? null
    )

    const title = applyResourcePrefix(args.outputTitle)

    const sr = await createDesignAutofillJob({
      client,
      body: {
        brand_template_id: args.sourceBrandTemplateId,
        title,
        data: autofillData,
      },
    })
    if (sr.error)
      throw new Error(`Canva autofill start: ${canvaError(sr.error)}`)
    const jobId = sr.data.job.id

    let attempt = 0
    while (attempt < 30) {
      const pr = await getDesignAutofillJob({ client, path: { jobId } })
      if (pr.error)
        throw new Error(`Canva autofill poll: ${canvaError(pr.error)}`)
      const poll = pr.data
      if (poll.job.status === "failed") {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: poll.job.error?.message ?? "Canva autofill job failed.",
        })
      }
      if (poll.job.status === "success") {
        const design = poll.job.result?.design
        if (!design?.id) {
          throw new ConvexError({
            code: "BAD_REQUEST",
            message: "Canva returned success without design details.",
          })
        }

        if (args.destinationFolderId !== "root") {
          const mr = await moveFolderItem({
            client,
            body: {
              item_id: design.id,
              to_folder_id: args.destinationFolderId,
            },
          })
          if (mr.error)
            throw new Error(`Canva move item: ${canvaError(mr.error)}`)
        }
        let previewImageUrl: string | null = design.thumbnail?.url ?? null
        try {
          if (!previewImageUrl) {
            const dr2 = await getDesign({
              client,
              path: { designId: design.id },
            })
            previewImageUrl = dr2.data?.design?.thumbnail?.url ?? null
          }
        } catch {
          previewImageUrl = null
        }
        const designUrl = buildCanvaDesignEditUrl(design.id)

        return {
          designId: design.id,
          title: design.title ?? args.outputTitle,
          url: designUrl,
          previewImageUrl,
        }
      }

      attempt += 1
      await sleep(1000)
    }

    throw new ConvexError({
      code: "TIMEOUT",
      message: "Timed out waiting for Canva autofill job.",
    })
  },
})

export const getDesignMetadata = action({
  args: {
    designId: v.string(),
  },
  returns: v.object({
    title: v.union(v.string(), v.null()),
    url: v.union(v.string(), v.null()),
    previewImageUrl: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const client = await requireCanvaClient(ctx)
    const r = await getDesign({ client, path: { designId: args.designId } })
    if (r.error) throw new Error(`Canva get design: ${canvaError(r.error)}`)
    const designMeta = r.data.design
    const url = buildCanvaDesignEditUrl(args.designId)
    return {
      title: designMeta?.title ?? null,
      url,
      previewImageUrl: designMeta?.thumbnail?.url ?? null,
    }
  },
})
