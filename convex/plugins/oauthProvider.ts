import type { OAuthService } from "@/convex/plugins/core/types"
import {
  readJsonObject,
  readNumber,
  readString,
  type JsonRecord,
} from "@/convex/plugins/core/jsonBoundary"

export interface OAuthPluginCliMeta {
  readonly providerDisplayName: string
  readonly providerArg: string
  readonly port: number
  readonly redirectHost: string
  readonly successHeading: string
  readonly missingAuthUrlMessage: string
  readonly usePkce?: boolean
  readonly useState?: boolean
}

export interface OAuthPluginMeta {
  readonly id: string
  readonly service: OAuthService
  readonly cli: OAuthPluginCliMeta
}

export interface OAuthClientConfig {
  displayName: string
  authorizationUrl: string
  tokenUrl: string
  scope: string
  clientIdEnv: string
  clientSecretEnv: string
  defaultExpiresInSec: number
  authStyle: "basic" | "body"
  expiryFromCreatedAt?: boolean
}

export interface StoredServiceToken {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

interface OAuthTokenPayload {
  accessToken: string
  expiresIn: number
  refreshToken: string | undefined
  createdAtSec: number | undefined
}

function parseOAuthToken(
  body: JsonRecord,
  defaultExpiresIn: number
): OAuthTokenPayload {
  const accessToken = readString(body, "access_token") ?? ""
  if (accessToken.length === 0) {
    throw new Error("Missing access_token in OAuth response")
  }
  return {
    accessToken,
    expiresIn: readNumber(body, "expires_in") ?? defaultExpiresIn,
    refreshToken: readString(body, "refresh_token"),
    createdAtSec: readNumber(body, "created_at"),
  }
}

export function matchesProvider(input: string, meta: OAuthPluginMeta): boolean {
  const normalized = input.trim().toLowerCase()
  return (
    normalized === meta.id ||
    normalized === meta.cli.providerArg.toLowerCase()
  )
}

export function redirectUri(meta: OAuthPluginMeta): string {
  return `http://${meta.cli.redirectHost}:${String(meta.cli.port)}`
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set in Convex env.`)
  }
  return value
}

function buildAuthorizeUrl(
  config: OAuthClientConfig,
  args: {
    redirectUri: string
    state: string
    extraParams?: Record<string, string>
  }
): string {
  const url = new URL(config.authorizationUrl)
  url.searchParams.set("client_id", requireEnv(config.clientIdEnv))
  url.searchParams.set("redirect_uri", args.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", config.scope)
  url.searchParams.set("state", args.state)
  for (const [key, value] of Object.entries(args.extraParams ?? {})) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

function tokenExpiresAt(
  parsed: OAuthTokenPayload,
  config: OAuthClientConfig
): number {
  const expiresIn = parsed.expiresIn
  if (
    config.expiryFromCreatedAt === true &&
    parsed.createdAtSec !== undefined
  ) {
    return parsed.createdAtSec + expiresIn
  }
  return Math.floor(Date.now() / 1000) + expiresIn
}

async function requestOAuthToken(
  config: OAuthClientConfig,
  body: URLSearchParams
): Promise<StoredServiceToken> {
  const clientId = requireEnv(config.clientIdEnv)
  const clientSecret = requireEnv(config.clientSecretEnv)
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  }
  if (config.authStyle === "basic") {
    headers.Authorization = `Basic ${globalThis.btoa(`${clientId}:${clientSecret}`)}`
  } else {
    body.set("client_id", clientId)
    body.set("client_secret", clientSecret)
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body,
  })
  if (!response.ok) {
    throw new Error(
      `${config.displayName} token request failed (HTTP ${String(response.status)}).`
    )
  }

  const bodyJson = await readJsonObject(response)
  if (bodyJson === null) {
    throw new Error(`${config.displayName} token response was not an object.`)
  }
  const parsed = parseOAuthToken(bodyJson, config.defaultExpiresInSec)
  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken ?? "",
    expiresAt: tokenExpiresAt(parsed, config),
  }
}

async function exchangeAuthorizationCode(
  config: OAuthClientConfig,
  args: {
    code: string
    redirectUri: string
    codeVerifier?: string
  }
): Promise<StoredServiceToken> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirectUri,
  })
  if (
    args.codeVerifier !== undefined &&
    args.codeVerifier !== ""
  ) {
    body.set("code_verifier", args.codeVerifier)
  }

  return await requestOAuthToken(config, body)
}

async function refreshAccessToken(
  config: OAuthClientConfig,
  refreshToken: string
): Promise<StoredServiceToken> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  })
  const refreshed = await requestOAuthToken(config, body)
  if (refreshed.refreshToken === "") {
    return { ...refreshed, refreshToken }
  }
  return refreshed
}

export function defineOAuthPlugin(def: {
  meta: OAuthPluginMeta
  client: OAuthClientConfig
  pkce?: boolean
}) {
  const { meta, client, pkce } = def
  return {
    meta,
    matches: (pluginId: string) => matchesProvider(pluginId, meta),
    redirectUri: () => redirectUri(meta),
    buildAuthorizeUrl(args: {
      redirectUri: string
      state: string
      codeChallenge?: string
    }) {
      const extraParams =
        pkce === true &&
        args.codeChallenge !== undefined &&
        args.codeChallenge !== ""
          ? {
              code_challenge: args.codeChallenge,
              code_challenge_method: "S256",
            }
          : undefined
      return buildAuthorizeUrl(client, {
        redirectUri: args.redirectUri,
        state: args.state,
        extraParams,
      })
    },
    exchangeCode: (args: {
      code: string
      redirectUri: string
      codeVerifier?: string
    }) => exchangeAuthorizationCode(client, args),
    refreshToken: (refreshToken: string) =>
      refreshAccessToken(client, refreshToken),
    client,
  }
}

export type OAuthPlugin = ReturnType<typeof defineOAuthPlugin>

export function cliConfigFromPlugin(plugin: OAuthPlugin) {
  return {
    providerDisplayName: plugin.meta.cli.providerDisplayName,
    successHeading: plugin.meta.cli.successHeading,
    port: plugin.meta.cli.port,
    redirectUri: plugin.redirectUri(),
    missingAuthUrlMessage: plugin.meta.cli.missingAuthUrlMessage,
    usePkce: plugin.meta.cli.usePkce,
    useState: plugin.meta.cli.useState,
  }
}
