import { env } from "@/convex/_generated/server"
import { ORGANISER_INVITE_PATH } from "@/convex/competitions/invites/validators"
import {
  resolveWcaApiBaseUrl,
  resolveWcaBaseUrl,
} from "@/convex/deploymentContext"
import { hqSiteUrl } from "@/convex/urls"

const WCA_LOGIN_SCOPE = "public email"

export interface WcaLoginProfile {
  wcaUserId: number
  name?: string
  email?: string
  avatarUrl?: string
}

interface WcaLoginCredentials {
  clientId: string
  clientSecret: string
}

function wcaLoginCredentials(): WcaLoginCredentials | null {
  const clientId = env.AUTH_WCA_ID
  const clientSecret = env.AUTH_WCA_SECRET
  if (clientId === undefined || clientSecret === undefined) {
    return null
  }
  return { clientId, clientSecret }
}

export function isWcaLoginConfigured(): boolean {
  return wcaLoginCredentials() !== null
}

export function wcaLoginRedirectUri(): string {
  return hqSiteUrl(ORGANISER_INVITE_PATH)
}

export function buildWcaAuthorizeUrl(state: string): string | null {
  const credentials = wcaLoginCredentials()
  if (credentials === null) {
    return null
  }
  const url = new URL(`${resolveWcaBaseUrl()}/oauth/authorize`)
  url.searchParams.set("client_id", credentials.clientId)
  url.searchParams.set("redirect_uri", wcaLoginRedirectUri())
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", WCA_LOGIN_SCOPE)
  if (state.length > 0) {
    url.searchParams.set("state", state)
  }
  return url.toString()
}

type JsonRecord = Record<string, object | string | number | boolean | null>

function asJsonRecord(
  value: object | string | number | boolean | null | undefined
): JsonRecord | null {
  if (value === null || value === undefined || typeof value !== "object") {
    return null
  }
  return isPlainObject(value) ? value : null
}

function isPlainObject(value: object): value is JsonRecord {
  return !Array.isArray(value)
}

function readString(record: JsonRecord, key: string): string | undefined {
  const value = record[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

export async function exchangeWcaCodeForProfile(
  code: string
): Promise<WcaLoginProfile | null> {
  const credentials = wcaLoginCredentials()
  if (credentials === null) {
    return null
  }

  const tokenResponse = await fetch(`${resolveWcaBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      redirect_uri: wcaLoginRedirectUri(),
    }),
  })
  if (!tokenResponse.ok) {
    return null
  }
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- fetch JSON boundary
  const tokenBody: object | null = await tokenResponse.json()
  const tokenRecord = asJsonRecord(tokenBody)
  if (tokenRecord === null) {
    return null
  }
  const accessToken = readString(tokenRecord, "access_token")
  if (accessToken === undefined) {
    return null
  }

  const meResponse = await fetch(`${resolveWcaApiBaseUrl()}/v0/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!meResponse.ok) {
    return null
  }
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- fetch JSON boundary
  const meBody: object | null = await meResponse.json()
  const meRecord = asJsonRecord(meBody)
  const profile = meRecord === null ? null : asJsonRecord(meRecord.me)
  if (profile === null || typeof profile.id !== "number") {
    return null
  }
  const avatar = asJsonRecord(profile.avatar)
  return {
    wcaUserId: profile.id,
    name: readString(profile, "name"),
    email: readString(profile, "email"),
    avatarUrl: avatar === null ? undefined : readString(avatar, "url"),
  }
}
