import type { Id } from "@/convex/_generated/dataModel"
import type { NotificationAction } from "@/convex/notifications/validators"

const VERSION = "n2"
const SIGNATURE_BYTES = 12
const ACTION_TTL_SECONDS = 7 * 24 * 60 * 60

type EncodedDeploymentContext = "production" | "staging"
type EncodedDeploymentContextPart = "p" | "s"
type EncodedActionKind = "c" | "a" | "s" | "z"

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(input.length / 4) * 4, "=")
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function safeBase64UrlToBytes(input: string): Uint8Array | null {
  if (!/^[\w-]*$/.test(input)) return null
  try {
    return base64UrlToBytes(input)
  } catch {
    return null
  }
}

async function hmacSha256(
  secret: string,
  payload: string
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  )
  return new Uint8Array(signature)
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index]
  }
  return diff === 0
}

function encodeDeploymentContext(
  deploymentContext: EncodedDeploymentContext
): EncodedDeploymentContextPart {
  return deploymentContext === "production" ? "p" : "s"
}

function decodeDeploymentContext(
  deploymentContext: string
): EncodedDeploymentContext | null {
  if (deploymentContext === "p") return "production"
  if (deploymentContext === "s") return "staging"
  return null
}

function encodeActionKind(action: NotificationAction): EncodedActionKind {
  switch (action.kind) {
    case "claimTask":
      return "c"
    case "approveTaskReview":
      return "a"
    case "startTask":
      return "s"
    case "snoozeReminder":
      return "z"
  }
}

function decodeTargetAction(
  kind: EncodedActionKind,
  target: string,
  preset?: string
): NotificationAction | null {
  switch (kind) {
    case "c":
      return {
        kind: "claimTask",
        // oxlint-disable-next-line typescript/consistent-type-assertions -- signed button payload boundary
        taskId: target as Id<"tasks">,
      }
    case "a":
      return {
        kind: "approveTaskReview",
        // oxlint-disable-next-line typescript/consistent-type-assertions -- signed button payload boundary
        taskId: target as Id<"tasks">,
      }
    case "s":
      return {
        kind: "startTask",
        // oxlint-disable-next-line typescript/consistent-type-assertions -- signed button payload boundary
        taskId: target as Id<"tasks">,
      }
    case "z":
      if (preset !== "1" && preset !== "t") return null
      return {
        kind: "snoozeReminder",
        // oxlint-disable-next-line typescript/consistent-type-assertions -- signed button payload boundary
        reminderId: target as Id<"taskReminders">,
        preset: preset === "1" ? "1h" : "tomorrow",
      }
  }
}

function decodeIssueAndExpiry(
  issued: string,
  expires: string
): { issuedAtSeconds: number; expiresAtSeconds: number } | null {
  const issuedAtSeconds = Number.parseInt(issued, 36)
  const expiresAtSeconds = Number.parseInt(expires, 36)
  if (!Number.isFinite(issuedAtSeconds)) return null
  if (!Number.isFinite(expiresAtSeconds)) return null
  return { issuedAtSeconds, expiresAtSeconds }
}

async function encodeV2NotificationAction(
  action: NotificationAction,
  secret: string,
  issuedAtSeconds: number,
  expiresAtSeconds: number,
  deploymentContext: EncodedDeploymentContext
) {
  const context = encodeDeploymentContext(deploymentContext)
  const kind = encodeActionKind(action)
  const issued = issuedAtSeconds.toString(36)
  const expires = expiresAtSeconds.toString(36)
  const target =
    action.kind === "snoozeReminder" ? action.reminderId : action.taskId
  const payload =
    action.kind === "snoozeReminder"
      ? [
          `${context}${kind}`,
          target,
          action.preset === "1h" ? "1" : "t",
          issued,
          expires,
        ].join(".")
      : [`${context}${kind}`, target, issued, expires].join(".")
  const signature = await hmacSha256(secret, payload)
  const signaturePart = bytesToBase64Url(signature.slice(0, SIGNATURE_BYTES))
  return `${VERSION}.${payload}.${signaturePart}`
}

export async function encodeNotificationAction(
  action: NotificationAction,
  secret: string,
  deploymentContext: EncodedDeploymentContext,
  nowMs = Date.now()
): Promise<string> {
  const issuedAtSeconds = Math.floor(nowMs / 1000)
  const expiresAtSeconds = issuedAtSeconds + ACTION_TTL_SECONDS
  return await encodeV2NotificationAction(
    action,
    secret,
    issuedAtSeconds,
    expiresAtSeconds,
    deploymentContext
  )
}

export async function decodeNotificationAction(
  customId: string,
  secret: string,
  nowMs = Date.now()
): Promise<
  | {
      ok: true
      action: NotificationAction
      deploymentContext: EncodedDeploymentContext
    }
  | {
      ok: false
      reason: "format" | "signature" | "expired"
      deploymentContext?: EncodedDeploymentContext
    }
> {
  if (!customId.startsWith(`${VERSION}.`)) {
    return { ok: false, reason: "format" }
  }
  const parts = customId.split(".")
  if (parts.length < 6) return { ok: false, reason: "format" }
  const contextAndKind = parts[1]
  const deploymentContext = decodeDeploymentContext(contextAndKind[0])
  const context =
    deploymentContext === null
      ? undefined
      : { deploymentContext: deploymentContext }

  if (contextAndKind.length !== 2) {
    return { ok: false, reason: "format", ...context }
  }
  if (deploymentContext === null) {
    return { ok: false, reason: "format" }
  }
  const kind = contextAndKind[1]
  if (kind !== "c" && kind !== "a" && kind !== "s" && kind !== "z") {
    return { ok: false, reason: "format", ...context }
  }
  if (parts.length !== (kind === "z" ? 7 : 6)) {
    return { ok: false, reason: "format", ...context }
  }

  const target = parts[2]
  if (target === "") {
    return { ok: false, reason: "format", ...context }
  }

  const signature = parts[parts.length - 1]
  if (signature === "") {
    return { ok: false, reason: "format", ...context }
  }
  const signatureBytes = safeBase64UrlToBytes(signature)
  if (signatureBytes === null) {
    return { ok: false, reason: "signature", ...context }
  }

  const payload = parts.slice(1, -1).join(".")
  const expectedSignature = (await hmacSha256(secret, payload)).slice(
    0,
    SIGNATURE_BYTES
  )
  if (!timingSafeEqual(signatureBytes, expectedSignature)) {
    return { ok: false, reason: "signature", ...context }
  }

  const timing =
    kind === "z"
      ? decodeIssueAndExpiry(parts[4] ?? "", parts[5] ?? "")
      : decodeIssueAndExpiry(parts[3] ?? "", parts[4] ?? "")
  if (timing === null) return { ok: false, reason: "format", ...context }

  const action = decodeTargetAction(
    kind,
    target,
    kind === "z" ? parts[3] : undefined
  )
  if (action === null) return { ok: false, reason: "format", ...context }
  if (timing.expiresAtSeconds < Math.floor(nowMs / 1000)) {
    return { ok: false, reason: "expired", ...context }
  }

  return { ok: true, action, deploymentContext }
}

export const DISCORD_CUSTOM_ID_LIMIT = 100
