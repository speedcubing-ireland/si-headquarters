import { env } from "@/convex/_generated/server"
import { ORGANISER_INVITE_PATH } from "@/convex/competitions/invites/validators"
import {
  resolveWcaApiBaseUrl,
  resolveWcaBaseUrl,
} from "@/convex/deploymentContext"
import {
  readJsonObject,
  readNumber,
  readRecord,
  readString,
} from "@/convex/integrations/jsonBoundary"
import { STAFF_WCA_LOGIN_PATH } from "@/convex/wcaLogin/wcaLoginPaths"
import { mainSiteUrl } from "@/convex/urls"

const WCA_LOGIN_SCOPE = "public email"

export type WcaLoginFlow = "organiser" | "staff"
type WcaCredentialEnvName = "AUTH_WCA_ID" | "AUTH_WCA_SECRET"

function configuredEnvValue(name: WcaCredentialEnvName): string | undefined {
  const source: Partial<Record<WcaCredentialEnvName, string>> = env
  const value = source[name]?.trim()
  return value === undefined || value.length === 0 ? undefined : value
}

function wcaLoginCredentials() {
  const clientId = configuredEnvValue("AUTH_WCA_ID")
  const clientSecret = configuredEnvValue("AUTH_WCA_SECRET")
  if (clientId === undefined || clientSecret === undefined) {
    return null
  }
  return { clientId, clientSecret }
}

export function isWcaLoginConfigured() {
  return wcaLoginCredentials() !== null
}

function wcaLoginRedirectUri(flow: WcaLoginFlow) {
  return mainSiteUrl(
    flow === "staff" ? STAFF_WCA_LOGIN_PATH : ORGANISER_INVITE_PATH
  )
}

export function buildWcaAuthorizeUrl(state: string, flow: WcaLoginFlow) {
  const credentials = wcaLoginCredentials()
  if (credentials === null) {
    return null
  }
  const url = new URL(`${resolveWcaBaseUrl()}/oauth/authorize`)
  url.searchParams.set("client_id", credentials.clientId)
  url.searchParams.set("redirect_uri", wcaLoginRedirectUri(flow))
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", WCA_LOGIN_SCOPE)
  if (state.length > 0) {
    url.searchParams.set("state", state)
  }
  return url.toString()
}

export async function exchangeWcaCodeForProfile(
  code: string,
  flow: WcaLoginFlow
) {
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
      redirect_uri: wcaLoginRedirectUri(flow),
    }),
  })
  if (!tokenResponse.ok) {
    return null
  }
  const tokenRecord = await readJsonObject(tokenResponse)
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
  const meRecord = await readJsonObject(meResponse)
  const profile = meRecord === null ? undefined : readRecord(meRecord, "me")
  if (profile === undefined) {
    return null
  }
  const wcaUserId = readNumber(profile, "id")
  if (wcaUserId === undefined) return null
  const avatar = readRecord(profile, "avatar")
  return {
    wcaUserId,
    name: readString(profile, "name"),
    email: readString(profile, "email"),
    avatarUrl: avatar === undefined ? undefined : readString(avatar, "url"),
  }
}
