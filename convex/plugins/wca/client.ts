import {
  createClient,
  createConfig,
  type Client,
} from "@/convex/plugins/wca/openapiClient/client"
import { WCA_BASE_URL } from "@/convex/plugins/wca/oauth"

export type WcaClient = Client

export function createWcaClient(accessToken: string): WcaClient {
  return createClient(
    createConfig({
      baseUrl: `${WCA_BASE_URL}/api`,
      headers: new Headers({
        Authorization: `Bearer ${accessToken}`,
      }),
    })
  )
}
