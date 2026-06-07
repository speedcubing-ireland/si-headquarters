import {
  createClient,
  createConfig,
  type Client,
} from "@/convex/plugins/wca/openapiClient/client"
import { resolveWcaApiBaseUrl } from "@/convex/deploymentContext"

export type WcaClient = Client

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
