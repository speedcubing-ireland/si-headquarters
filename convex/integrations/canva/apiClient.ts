import { createClient, createConfig } from "./client/client";
import type { Client } from "./client/client";

export type CanvaClient = Client;

export function createCanvaClient(accessToken: string): CanvaClient {
  return createClient(
    createConfig({
      baseUrl: "https://api.integrations.canva.actions.com/rest",
      headers: new Headers({
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      }),
    })
  );
}
