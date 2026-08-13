import { generatePkcePair } from "../../convex/plugins/pkce.ts"
import { convexRun } from "./convex-run.ts"

interface OAuthAuthResponse {
  url: string
  state?: string
}

interface OAuthExchangeResponse {
  success: boolean
  error?: string
}

export interface CliOAuthConfig {
  providerDisplayName: string
  successHeading: string
  port: number
  redirectUri: string
  missingAuthUrlMessage: string
  usePkce?: boolean
  useState?: boolean
}

const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8" } as const

function openBrowser(url: string) {
  const cmd =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url]
  Bun.spawn({ cmd, stdout: "ignore", stderr: "ignore" })
}

function htmlPage(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:1rem;text-align:center">${body}</body></html>`
}

function htmlOk(heading: string) {
  return htmlPage(
    heading,
    `<h1>${heading}</h1><p>You can close this tab and return to the terminal.</p>`
  )
}

function htmlErr(message: string) {
  return htmlPage(
    "Error",
    `<h1>Linking failed</h1><p style="color:red">${message.replace(/</g, "&lt;")}</p><p>You can close this tab and try again in the terminal.</p>`
  )
}

function requireCliToken(): string {
  const cliToken = process.env.CLI_AUTH_TOKEN
  if (cliToken !== undefined && cliToken !== "") return cliToken
  console.error(
    [
      "Error: CLI_AUTH_TOKEN is not set.",
      "Set it in your Convex dashboard, then export it locally:",
      "  export CLI_AUTH_TOKEN=your-secret-token",
    ].join("\n")
  )
  process.exit(1)
}

export async function runCliOAuth(pluginId: string): Promise<void> {
  const cliToken = requireCliToken()

  let cfg: CliOAuthConfig
  try {
    cfg = await convexRun<CliOAuthConfig>("plugins/oauth:getCliConfig", {
      pluginId,
      cliToken,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Unknown provider "${pluginId}". ${message}`)
    process.exit(1)
  }

  console.log(`${cfg.providerDisplayName} OAuth`)
  console.log(`Redirect URI: ${cfg.redirectUri}\n`)

  const redirectUrl = new URL(cfg.redirectUri)
  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"])
  const { hostname: redirectHost } = redirectUrl
  if (typeof redirectHost !== "string") {
    throw new Error("Invalid redirect URI hostname.")
  }
  if (!allowedHosts.has(redirectHost)) {
    throw new Error(`Unsafe redirect host '${redirectHost}'.`)
  }

  const pkce = cfg.usePkce === true ? await generatePkcePair() : null
  const requestedState = cfg.useState === true ? crypto.randomUUID() : undefined

  const auth = await convexRun<OAuthAuthResponse>("plugins/oauth:getOAuthUrl", {
    pluginId,
    cliToken,
    redirectUri: cfg.redirectUri,
    codeChallenge: pkce?.codeChallenge,
    state: requestedState,
  })

  if (auth.url === "") {
    console.error(cfg.missingAuthUrlMessage)
    process.exit(1)
  }

  const expectedState =
    cfg.useState === true ? (auth.state ?? requestedState) : undefined

  let resolveExchange!: (result: OAuthExchangeResponse) => void
  const exchangeDone = new Promise<OAuthExchangeResponse>((resolve) => {
    resolveExchange = resolve
  })

  const server = Bun.serve({
    hostname: redirectUrl.hostname,
    port: cfg.port,
    async fetch(req) {
      const url = new URL(req.url)
      const code = url.searchParams.get("code")
      if (code === null || code === "") {
        return new Response("Missing code", { status: 400 })
      }
      if (
        expectedState !== undefined &&
        url.searchParams.get("state") !== expectedState
      ) {
        resolveExchange({ success: false, error: "Invalid OAuth state" })
        return new Response(htmlErr("Invalid OAuth state"), {
          headers: HTML_HEADERS,
          status: 400,
        })
      }

      try {
        const result = await convexRun<OAuthExchangeResponse>(
          "plugins/oauth:exchangeCodeAndStoreTokens",
          {
            pluginId,
            cliToken,
            code,
            redirectUri: cfg.redirectUri,
            codeVerifier: pkce?.codeVerifier,
          }
        )
        resolveExchange(result)
        return new Response(
          result.success
            ? htmlOk(cfg.successHeading)
            : htmlErr(result.error ?? "Exchange failed"),
          {
            headers: HTML_HEADERS,
            status: result.success ? 200 : 400,
          }
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        resolveExchange({ success: false, error: message })
        return new Response(htmlErr(message), {
          headers: HTML_HEADERS,
          status: 500,
        })
      }
    },
  })

  console.log(`Opening browser for ${cfg.providerDisplayName} sign-in...\n`)
  openBrowser(auth.url)
  const result = await exchangeDone
  await server.stop()

  if (result.success) {
    console.log(`Done. ${cfg.providerDisplayName} tokens are stored in Convex.`)
    process.exit(0)
  }
  console.error(
    `${cfg.providerDisplayName} OAuth failed. Tokens were not stored.`
  )
  process.exit(1)
}

export async function printOAuthUsage() {
  const providers = await convexRun<string[]>(
    "plugins/oauth:listProviders",
    {}
  ).catch((): string[] => [])
  console.error(
    [
      "Usage:  bun run auth <provider>",
      "",
      providers.length > 0
        ? `Providers: ${providers.join(", ")}`
        : "No OAuth providers are configured.",
      "",
      "Example:  CONVEX_PROD=1 bun run auth canva",
    ].join("\n")
  )
}
