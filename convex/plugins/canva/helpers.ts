import { ConvexError } from "convex/values"
import {
  isPlainObject,
  type JsonFieldValue,
  type JsonRecord,
  readJsonObject,
  readRecord,
  readString,
} from "@/convex/integrations/jsonBoundary"

export interface CanvaDatasetField {
  type: string
}

const CANVA_RESOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/

function isCanvaUrl(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    (url.hostname === "canva.com" || url.hostname.endsWith(".canva.com"))
  )
}

export function buildCanvaAutofillData(
  dataset: Record<string, CanvaDatasetField> | undefined,
  competitionName: string | null | undefined
): Record<string, { type: "text"; text: string }> {
  if (dataset === undefined) {
    return {}
  }

  const compIdValue = competitionName?.trim() ?? ""
  const result: Record<string, { type: "text"; text: string }> = {}

  for (const [fieldKey, field] of Object.entries(dataset)) {
    if (field.type !== "text") {
      continue
    }
    result[fieldKey] = {
      type: "text",
      text: fieldKey.toUpperCase() === "COMP_ID" ? compIdValue : "",
    }
  }

  return result
}

export function buildCanvaDesignEditUrl(designId: string): string {
  return `https://www.canva.com/design/${encodeURIComponent(designId.trim())}/edit`
}

export function parseCanvaDesignUrl(url: string): {
  designId: string
  designUrl: string
} {
  const trimmed = url.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Could not parse Canva design id from URL.",
    })
  }
  const match = /^\/design\/([^/]+)(?:\/|$)/.exec(parsed.pathname)
  const designId = match?.[1]
  if (
    !isCanvaUrl(parsed) ||
    designId === undefined ||
    !CANVA_RESOURCE_ID_PATTERN.test(designId)
  ) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Could not parse Canva design id from URL.",
    })
  }
  return {
    designId,
    designUrl: buildCanvaDesignEditUrl(designId),
  }
}

export async function fetchCanvaDesignMetadata(
  accessToken: string,
  designId: string
): Promise<{ title: string; thumbnailUrl?: string }> {
  const design = await fetchCanvaDesignRecord(accessToken, designId)
  const title = readString(design, "title")
  if (title === undefined || title.trim() === "") {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Canva design has no title.",
    })
  }
  return { title: title.trim(), thumbnailUrl: canvaThumbnailUrl(design) }
}

export async function fetchCanvaThumbnailUrl(
  accessToken: string,
  designId: string
): Promise<string | undefined> {
  return canvaThumbnailUrl(await fetchCanvaDesignRecord(accessToken, designId))
}

async function fetchCanvaDesignRecord(
  accessToken: string,
  designId: string
): Promise<JsonRecord> {
  const response = await fetch(
    `https://api.canva.com/rest/v1/designs/${encodeURIComponent(designId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!response.ok) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Could not load Canva design (HTTP ${String(response.status)}).`,
    })
  }
  const body = await readJsonObject(response)
  const design = body !== null ? readRecord(body, "design") : undefined
  if (design === undefined) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Canva design lookup returned an invalid response.",
    })
  }
  return design
}

function canvaThumbnailUrl(design: JsonRecord): string | undefined {
  const thumbnail = readRecord(design, "thumbnail")
  return thumbnail !== undefined ? readString(thumbnail, "url") : undefined
}

export function parseCanvaFolderInput(value: string): string {
  const trimmed = value.trim()
  if (trimmed === "") {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Folder value is required.",
    })
  }
  if (trimmed === "root") {
    return "root"
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const folderId = parseCanvaFolderIdFromUrl(trimmed)
    if (folderId === null) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Folder URL must look like https://www.canva.com/folder/<id>",
      })
    }
    return folderId
  }

  if (!CANVA_RESOURCE_ID_PATTERN.test(trimmed)) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Folder must be a Canva folder ID or Canva folder URL.",
    })
  }
  return trimmed
}

function parseCanvaFolderIdFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (!isCanvaUrl(url)) {
      return null
    }
    const segments = url.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
    const folderIndex = segments.indexOf("folder")
    if (folderIndex < 0) {
      return null
    }
    if (folderIndex + 1 >= segments.length) {
      return null
    }
    const folderId = decodeURIComponent(segments[folderIndex + 1])
    return CANVA_RESOURCE_ID_PATTERN.test(folderId) ? folderId : null
  } catch {
    return null
  }
}

export async function readCanvaDataset(
  accessToken: string,
  brandTemplateId: string
): Promise<Record<string, CanvaDatasetField>> {
  const response = await fetch(
    `https://api.canva.com/rest/v1/brand-templates/${encodeURIComponent(brandTemplateId)}/dataset`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  if (!response.ok) {
    throw new Error(
      `Canva template dataset lookup failed (HTTP ${String(response.status)}).`
    )
  }
  const body = await readJsonObject(response)
  if (body === null) {
    throw new Error("Canva template dataset returned an invalid response.")
  }
  const datasetRecord = readRecord(body, "dataset")
  if (datasetRecord === undefined) {
    return {}
  }
  const dataset: Record<string, CanvaDatasetField> = {}
  for (const [key, value] of Object.entries(datasetRecord)) {
    const field = parseCanvaDatasetField(value)
    if (field !== undefined) {
      dataset[key] = field
    }
  }
  return dataset
}

function parseCanvaDatasetField(
  value: JsonFieldValue
): CanvaDatasetField | undefined {
  if (typeof value !== "object" || value === null || !isPlainObject(value)) {
    return undefined
  }
  const type = readString(value, "type")
  if (type === undefined) {
    return undefined
  }
  return { type }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function runCanvaAutofillJob(
  accessToken: string,
  input: {
    brandTemplateId: string
    title: string
    competitionName: string
    destinationFolderId: string
  }
): Promise<{
  designId: string
  designUrl: string
}> {
  const folderId = parseCanvaFolderInput(input.destinationFolderId)
  const dataset = await readCanvaDataset(accessToken, input.brandTemplateId)
  if (Object.keys(dataset).length === 0) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message:
        "Selected Canva template has no autofill-capable fields. Choose a template configured for autofill.",
    })
  }

  const autofillData = buildCanvaAutofillData(dataset, input.competitionName)

  const startResponse = await fetch("https://api.canva.com/rest/v1/autofills", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      brand_template_id: input.brandTemplateId,
      title: input.title,
      data: autofillData,
    }),
  })
  if (!startResponse.ok) {
    throw new Error(
      `Canva autofill start failed (HTTP ${String(startResponse.status)}).`
    )
  }
  const startBody = await readJsonObject(startResponse)
  const jobRecord =
    startBody !== null ? readRecord(startBody, "job") : undefined
  const jobId =
    jobRecord !== undefined ? readString(jobRecord, "id") : undefined
  if (jobId === undefined) {
    throw new Error("Canva autofill did not return a job id.")
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const pollResponse = await fetch(
      `https://api.canva.com/rest/v1/autofills/${encodeURIComponent(jobId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    if (!pollResponse.ok) {
      throw new Error(
        `Canva autofill poll failed (HTTP ${String(pollResponse.status)}).`
      )
    }
    const pollBody = await readJsonObject(pollResponse)
    const pollJob = pollBody !== null ? readRecord(pollBody, "job") : undefined
    const status =
      pollJob !== undefined ? readString(pollJob, "status") : undefined

    if (status === "failed") {
      const errorRecord =
        pollJob !== undefined ? readRecord(pollJob, "error") : undefined
      const message =
        errorRecord !== undefined
          ? readString(errorRecord, "message")
          : undefined
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: message ?? "Canva autofill job failed.",
      })
    }

    if (status === "success") {
      const resultRecord =
        pollJob !== undefined ? readRecord(pollJob, "result") : undefined
      const designRecord =
        resultRecord !== undefined
          ? readRecord(resultRecord, "design")
          : undefined
      const designId =
        designRecord !== undefined ? readString(designRecord, "id") : undefined
      if (designId === undefined) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Canva returned success without design details.",
        })
      }

      if (folderId !== "root") {
        const moveResponse = await fetch(
          "https://api.canva.com/rest/v1/folders/move",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              item_id: designId,
              to_folder_id: folderId,
            }),
          }
        )
        if (!moveResponse.ok) {
          throw new Error(
            `Canva folder move failed (HTTP ${String(moveResponse.status)}).`
          )
        }
      }

      return {
        designId,
        designUrl: buildCanvaDesignEditUrl(designId),
      }
    }

    await sleep(1000)
  }

  throw new ConvexError({
    code: "TIMEOUT",
    message: "Timed out waiting for Canva autofill job.",
  })
}
