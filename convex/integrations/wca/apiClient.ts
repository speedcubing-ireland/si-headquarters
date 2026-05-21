import { createClient, createConfig } from "./client/client";
import type { Client } from "./client/client";
import { WCA_BASE_URL } from "./index";

export type WcaClient = Client;

export function createWcaClient(accessToken: string): WcaClient {
  return createClient(
    createConfig({
      baseUrl: `${WCA_BASE_URL}/api`,
      headers: new Headers({
        Authorization: `Bearer ${accessToken}`,
      }),
    })
  );
}
