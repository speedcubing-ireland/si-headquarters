import type { DataModel } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { GenericActionCtx } from "convex/server";
import { ConvexError } from "convex/values";

export async function requireVolunteerAction(
	ctx: GenericActionCtx<DataModel>,
	cliToken?: string,
): Promise<void> {
	if (cliToken) {
		const expectedToken = process.env.CLI_AUTH_TOKEN;
		if (expectedToken && cliToken === expectedToken) return;
		throw new ConvexError({
			code: "UNAUTHENTICATED",
			message: "Invalid CLI token",
		});
	}
	const isVol = await ctx.runQuery(internal.auth.getIsVolunteer, {});
	if (!isVol) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "Volunteer access required",
		});
	}
}

export function buildOAuthUrl(params: {
	baseUrl: string;
	clientId: string;
	redirectUri: string;
	scope: string;
	state?: string;
}): string {
	const url = new URL(params.baseUrl);
	url.searchParams.set("client_id", params.clientId);
	url.searchParams.set("redirect_uri", params.redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", params.scope);
	if (params.state) {
		url.searchParams.set("state", params.state);
	}
	return url.toString();
}
