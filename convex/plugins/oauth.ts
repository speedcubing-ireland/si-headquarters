import { ConvexError, v } from "convex/values"
import { action, env, query } from "../_generated/server"
import { internal } from "../_generated/api"
import { OAUTH_PLUGINS, oauthPluginById } from "@/convex/plugins/oauthRegistry"
import { cliConfigFromPlugin } from "./oauthProvider"

function requireCliToken(cliToken: string) {
  const expected = env.CLI_AUTH_TOKEN
  if (expected === "")
    throw new ConvexError({
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

export const listProviders = query({
  args: {},
  returns: v.array(v.string()),
  handler: () => OAUTH_PLUGINS.map((plugin) => plugin.meta.cli.providerArg),
})

export const getCliConfig = query({
  args: {
    pluginId: v.string(),
    cliToken: v.string(),
  },
  returns: v.object({
    providerDisplayName: v.string(),
    successHeading: v.string(),
    port: v.number(),
    redirectUri: v.string(),
    missingAuthUrlMessage: v.string(),
    usePkce: v.optional(v.boolean()),
    useState: v.optional(v.boolean()),
  }),
  handler: (_ctx, args) => {
    requireCliToken(args.cliToken)
    return cliConfigFromPlugin(oauthPluginById(args.pluginId))
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
  returns: v.object({
    url: v.string(),
    state: v.string(),
  }),
  handler: (_ctx, args) => {
    requireCliToken(args.cliToken)
    const plugin = oauthPluginById(args.pluginId)
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
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    requireCliToken(args.cliToken)
    const plugin = oauthPluginById(args.pluginId)
    try {
      const token = await plugin.exchangeCode({
        code: args.code,
        redirectUri: args.redirectUri,
        codeVerifier: args.codeVerifier,
      })
      await ctx.runMutation(internal.plugins.core.tokensStore.saveToken, {
        service: plugin.meta.service,
        token,
      })
      return { success: true as const }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false as const, error: message }
    }
  },
})
