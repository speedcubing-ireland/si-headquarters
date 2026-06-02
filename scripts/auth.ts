#!/usr/bin/env bun
/**
 * OAuth terminal flow. Provider config lives in convex/plugins/<name>/oauth.ts.
 *
 * Usage:
 *   bun run auth <provider>   # canva | google | wca
 *   CONVEX_PROD=1 bun run auth wca
 *
 * Required env:
 *   CLI_AUTH_TOKEN — must match CLI_AUTH_TOKEN in your Convex deployment
 */
import { printOAuthUsage, runCliOAuth } from "./lib/oauth-cli.ts"

const pluginId = process.argv[2]
if (pluginId === undefined || pluginId === "") {
  await printOAuthUsage()
  process.exit(1)
}

await runCliOAuth(pluginId)
