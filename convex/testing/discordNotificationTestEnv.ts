const DISCORD_TEST_BOT_TOKEN = "test-discord-bot-token"
const DISCORD_TEST_ACTION_SECRET = "test-discord-action-secret"
const DISCORD_TEST_DEPLOYMENT_CONTEXT = "production"

export function applyDiscordNotificationTestEnv(): void {
  process.env.DISCORD_BOT_TOKEN ??= DISCORD_TEST_BOT_TOKEN
  process.env.DISCORD_ACTION_SECRET ??= DISCORD_TEST_ACTION_SECRET
  process.env.DEPLOYMENT_CONTEXT ??= DISCORD_TEST_DEPLOYMENT_CONTEXT
}

export function installDiscordApiFetchStub(): void {
  const originalFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString()
    if (!url.includes("discord.com/api")) {
      return originalFetch(input, init)
    }
    if (url.endsWith("/users/@me/channels")) {
      return Response.json({ id: "test-discord-channel" })
    }
    if (url.includes("/channels/") && url.includes("/messages")) {
      return new Response(null, { status: 204 })
    }
    return new Response(null, { status: 404 })
  }
}
