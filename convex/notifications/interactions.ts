import { internal } from "@/convex/_generated/api"
import { env, httpAction, internalAction } from "@/convex/_generated/server"
import { decodeNotificationAction } from "@/convex/notifications/actionCodec"
import { resolveDeploymentContext } from "@/convex/deploymentContext"
import { requireConvexEnv } from "@/convex/envTypes"
import { verifyAsync } from "@noble/ed25519"
import { v } from "convex/values"
import { organisationConfig } from "@/config/lib/organisation"

const DISCORD_API = "https://discord.com/api/v10"
const DISCORD_INTERACTION_PING = 1
const DISCORD_INTERACTION_MESSAGE_COMPONENT = 3
const DISCORD_RESPONSE_PONG = 1
const DISCORD_RESPONSE_CHANNEL_MESSAGE = 4
const DISCORD_RESPONSE_UPDATE_MESSAGE = 7
const EPHEMERAL_FLAG = 1 << 6

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject

interface JsonObject {
  [key: string]: JsonValue | undefined
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function jsonResponse(body: JsonValue, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function textEncoderBytes(value: string) {
  return new TextEncoder().encode(value)
}

function hexToBytes(hex: string) {
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2 !== 0) {
    return null
  }
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

async function verifyDiscordSignature(req: Request, rawBody: string) {
  const signatureHex = req.headers.get("x-signature-ed25519")
  const timestamp = req.headers.get("x-signature-timestamp")
  if (signatureHex === null || timestamp === null) return false

  const signature = hexToBytes(signatureHex)
  const publicKey = hexToBytes(
    requireConvexEnv(
      "DISCORD_PUBLIC_KEY",
      "Discord interactions require DISCORD_PUBLIC_KEY to be set."
    )
  )
  if (signature === null || publicKey === null) return false

  return await verifyAsync(
    signature,
    textEncoderBytes(`${timestamp}${rawBody}`),
    publicKey
  )
}

function ephemeral(content: string) {
  return jsonResponse({
    type: DISCORD_RESPONSE_CHANNEL_MESSAGE,
    data: {
      flags: EPHEMERAL_FLAG,
      content,
    },
  })
}

function interactionUserId(payload: JsonObject) {
  const member = payload.member
  if (isJsonObject(member)) {
    const user = member.user
    if (isJsonObject(user)) {
      const id = user.id
      if (typeof id === "string") return id
    }
  }

  const user = payload.user
  if (isJsonObject(user)) {
    const id = user.id
    if (typeof id === "string") return id
  }

  return null
}

function customId(payload: JsonObject) {
  const data = payload.data
  if (!isJsonObject(data)) return null
  const id = data.custom_id
  return typeof id === "string" ? id : null
}

function wrongDeploymentMessage(
  buttonDeploymentContext: "production" | "staging",
  currentDeploymentContext: "production" | "staging"
) {
  const productName = organisationConfig.organisation.productName
  return `This button belongs to ${buttonDeploymentContext} ${productName}, but Discord sent it to ${currentDeploymentContext} ${productName}. Ask a ${productName} admin to resend it from the right ${productName} environment.`
}

export const discordInteractions = httpAction(async (ctx, req) => {
  const rawBody = await req.text()
  if (!(await verifyDiscordSignature(req, rawBody))) {
    return new Response("Invalid request signature", { status: 401 })
  }

  let parsed: JsonValue
  try {
    // eslint-disable-next-line typescript/no-unsafe-assignment
    parsed = JSON.parse(rawBody)
  } catch {
    return new Response("Malformed JSON", { status: 400 })
  }
  if (!isJsonObject(parsed))
    return new Response("Malformed JSON", { status: 400 })
  const payload = parsed

  if (payload.type === DISCORD_INTERACTION_PING) {
    return jsonResponse({ type: DISCORD_RESPONSE_PONG })
  }

  if (payload.type !== DISCORD_INTERACTION_MESSAGE_COMPONENT) {
    return ephemeral("This Discord interaction is not supported yet.")
  }

  const discordUserId = interactionUserId(payload)
  const id = customId(payload)
  if (discordUserId === null || id === null) {
    return ephemeral("This button payload is missing required Discord data.")
  }

  const secret = env.DISCORD_ACTION_SECRET?.trim()
  if (secret === undefined || secret.length === 0) {
    console.warn("DISCORD_ACTION_SECRET is not set for Discord interactions.")
    return ephemeral(
      `Discord actions are not configured correctly. Ask a ${organisationConfig.organisation.productName} admin to resend this from ${organisationConfig.organisation.productName}.`
    )
  }

  const decoded = await decodeNotificationAction(id, secret)
  const currentDeploymentContext = resolveDeploymentContext()
  if (
    decoded.deploymentContext !== undefined &&
    decoded.deploymentContext !== currentDeploymentContext
  ) {
    return ephemeral(
      wrongDeploymentMessage(
        decoded.deploymentContext,
        currentDeploymentContext
      )
    )
  }
  if (!decoded.ok) {
    return ephemeral(
      decoded.reason === "expired"
        ? `This button has expired. Open ${organisationConfig.organisation.productName} to continue.`
        : `This button is no longer valid. Ask a ${organisationConfig.organisation.productName} admin to resend this from ${organisationConfig.organisation.productName}.`
    )
  }

  const result = await ctx.runMutation(
    internal.notifications.actions.executeDiscordAction,
    { discordUserId, action: decoded.action }
  )

  if (result.updateMessage !== undefined) {
    const data = await ctx.runQuery(
      internal.notifications.model.resolveAssignableClaimedDiscordUpdate,
      { taskId: result.updateMessage }
    )
    if (data !== null) {
      const token = payload.token
      const applicationId = payload.application_id
      if (
        result.content !== "Task claimed." &&
        typeof token === "string" &&
        typeof applicationId === "string"
      ) {
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.interactions.sendFollowup,
          { applicationId, token, content: result.content }
        )
      }
      return jsonResponse({ type: DISCORD_RESPONSE_UPDATE_MESSAGE, data })
    }
  }

  return ephemeral(result.content)
})

export const sendFollowup = internalAction({
  args: {
    applicationId: v.string(),
    token: v.string(),
    content: v.string(),
  },
  handler: async (_, args) => {
    await fetch(`${DISCORD_API}/webhooks/${args.applicationId}/${args.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: args.content, flags: EPHEMERAL_FLAG }),
    })
  },
})
