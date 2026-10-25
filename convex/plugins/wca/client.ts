import {
  createClient,
  createConfig,
  type Client,
} from "@/convex/plugins/wca/openapiClient/client"
import { resolveWcaApiBaseUrl } from "@/convex/deploymentContext"

export type WcaClient = Client

/**
 * A client for the WCA's public endpoints (records, the competition index).
 * Needs no access token, so callers keep working while the WCA service account
 * is disconnected.
 */
export function createPublicWcaClient(): WcaClient {
  return createClient(createConfig({ baseUrl: resolveWcaApiBaseUrl() }))
}

export function createWcaClient(accessToken: string): WcaClient {
  return createClient(
    createConfig({
      baseUrl: resolveWcaApiBaseUrl(),
      headers: new Headers({
        Authorization: `Bearer ${accessToken}`,
      }),
    })
  )
}
