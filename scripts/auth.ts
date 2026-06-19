#!/usr/bin/env bun
import { printOAuthUsage, runCliOAuth } from "./lib/oauth-cli.ts"

const pluginId = process.argv[2]
if (pluginId === undefined || pluginId === "") {
  await printOAuthUsage()
  process.exit(1)
}

await runCliOAuth(pluginId)
