import { createClient, createConfig } from "./client/client/index";
import type { Client } from "./client/client/index";

export type WcaClient = Client;

export function createWcaClient(accessToken: string): WcaClient {
	return createClient(
		createConfig({
			baseUrl: "https://www.worldcubeassociation.org/api",
			headers: new Headers({
				Authorization: `Bearer ${accessToken}`,
			}),
		}),
	);
}
