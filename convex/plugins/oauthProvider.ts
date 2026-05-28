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
  readonly service: string
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function extractJsonStringField(body: string, field: string): string | undefined {
  const match = new RegExp(
    `"${escapeRegExp(field)}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`
  ).exec(body)
  if (match?.[1] === undefined) {
    return undefined
  }
  return match[1]
    .replaceAll("\\\\", "\\")
    .replaceAll('\\"', '"')
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r")
    .replaceAll("\\t", "\t")
}

function extractJsonNumberField(body: string, field: string): number | undefined {
  const match = new RegExp(
    `"${escapeRegExp(field)}"\\s*:\\s*(\\d+(?:\\.\\d+)?)`
  ).exec(body)
  if (match?.[1] === undefined) {
    return undefined
  }
  return Number(match[1])
}

function parseOAuthToken(
  text: string,
  defaultExpiresIn: number
): OAuthTokenPayload {
  const accessToken = extractJsonStringField(text, "access_token") ?? ""
  if (accessToken.length === 0) {
    throw new Error("Missing access_token in OAuth response")
  }
  return {
    accessToken,
    expiresIn: extractJsonNumberField(text, "expires_in") ?? defaultExpiresIn,
    refreshToken: extractJsonStringField(text, "refresh_token"),
    createdAtSec: extractJsonNumberField(text, "created_at"),
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

  const parsed = parseOAuthToken(
    await response.text(),
    config.defaultExpiresInSec
  )
  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken ?? "",
    expiresAt: tokenExpiresAt(parsed, config),
  }
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
