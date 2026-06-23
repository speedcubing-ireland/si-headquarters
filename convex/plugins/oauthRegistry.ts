import { ConvexError } from "convex/values"
import type { OAuthService } from "@/convex/integrations/validators"
import { plugin as canvaPlugin } from "@/convex/plugins/canva/oauth"
import { plugin as googlePlugin } from "@/convex/plugins/google/oauth"
import type { OAuthPlugin } from "@/convex/plugins/oauthProvider"
import { plugin as wcaPlugin } from "@/convex/plugins/wca/oauth"
import { isFeatureEnabled } from "@/config/lib/organisation"

export const OAUTH_PLUGINS: readonly OAuthPlugin[] = [
  ...(isFeatureEnabled("canva") ? [canvaPlugin] : []),
  ...(isFeatureEnabled("google") ? [googlePlugin] : []),
  ...(isFeatureEnabled("wcaIntegration") ? [wcaPlugin] : []),
]

export function oauthPluginById(pluginId: string): OAuthPlugin {
  const plugin = OAUTH_PLUGINS.find((entry) => entry.matches(pluginId))
  if (plugin === undefined) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: `Unknown OAuth provider '${pluginId}'.`,
    })
  }
  return plugin
}

export function oauthPluginForService(service: OAuthService): OAuthPlugin {
  const plugin = OAUTH_PLUGINS.find((entry) => entry.meta.service === service)
  if (plugin === undefined) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `No OAuth provider configured for service '${service}'.`,
    })
  }
  return plugin
}
