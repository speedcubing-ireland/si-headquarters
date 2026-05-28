import { ConvexError, v } from "convex/values"
import { action, query } from "../_generated/server"
import { api } from "../_generated/api"
import { plugin as canvaPlugin } from "./canva/oauth"
import { plugin as wcaPlugin } from "./wca/oauth"
import { cliConfigFromPlugin, type OAuthPlugin } from "./oauthProvider"

const OAUTH_PLUGINS: OAuthPlugin[] = [canvaPlugin, wcaPlugin]

function requireCliToken(cliToken: string) {
  const expected = process.env.CLI_AUTH_TOKEN
  if (expected === undefined) throw new ConvexError({
    code: "INTERNAL_ERROR",
    message: "CLI_AUTH_TOKEN is not set in Convex env.",
  })
  if (cliToken !== expected) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Invalid CLI token",
    })
  }
}

function requirePlugin(pluginId: string): OAuthPlugin {
  const plugin = OAUTH_PLUGINS.find((entry) => entry.matches(pluginId))
  if (plugin === undefined) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: `Unknown OAuth provider '${pluginId}'.`,
    })
  }
  return plugin
}

export const listProviders = query({
  args: {},
  handler: () => OAUTH_PLUGINS.map((plugin) => plugin.meta.cli.providerArg),
})

export const getCliConfig = query({
  args: {
    pluginId: v.string(),
    cliToken: v.string(),
  },
  handler: (_ctx, args) => {
    requireCliToken(args.cliToken)
    return cliConfigFromPlugin(requirePlugin(args.pluginId))
  },
})

export const getOAuthUrl = action({
  args: {
    pluginId: v.string(),
    redirectUri: v.string(),
    state: v.optional(v.string()),
    codeChallenge: v.optional(v.string()),
    cliToken: v.string(),
  },
  handler: (_ctx, args) => {
    requireCliToken(args.cliToken)
    const plugin = requirePlugin(args.pluginId)
    const state = args.state ?? crypto.randomUUID()
    return {
      url: plugin.buildAuthorizeUrl({
        redirectUri: args.redirectUri,
        state,
        codeChallenge: args.codeChallenge,
      }),
      state,
    }
  },
})

export const exchangeCodeAndStoreTokens = action({
  args: {
    pluginId: v.string(),
    code: v.string(),
    redirectUri: v.string(),
    codeVerifier: v.optional(v.string()),
    cliToken: v.string(),
  },
  handler: async (ctx, args) => {
    requireCliToken(args.cliToken)
    const plugin = requirePlugin(args.pluginId)
    try {
      const token = await plugin.exchangeCode({
        code: args.code,
        redirectUri: args.redirectUri,
        codeVerifier: args.codeVerifier,
      })
      await ctx.runMutation(api.plugins.tokens.setToken, {
        service: plugin.meta.service,
        token,
      })
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  },
})
