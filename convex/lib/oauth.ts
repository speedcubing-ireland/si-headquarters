import type { DataModel } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { GenericActionCtx } from "convex/server";
import { ConvexError } from "convex/values";

function hasValidCliToken(cliToken: string | undefined): boolean {
	if (!cliToken) return false;
	const expectedToken = process.env.CLI_AUTH_TOKEN;
	return Boolean(expectedToken && cliToken === expectedToken);
}

export async function requireVolunteerAction(
	ctx: GenericActionCtx<DataModel>,
	cliToken?: string,
): Promise<void> {
	if (hasValidCliToken(cliToken)) return;
	if (cliToken) {
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

export async function requireDirectorAction(
	ctx: GenericActionCtx<DataModel>,
	cliToken?: string,
): Promise<void> {
	if (hasValidCliToken(cliToken)) return;
	if (cliToken) {
		throw new ConvexError({
			code: "UNAUTHENTICATED",
			message: "Invalid CLI token",
		});
	}
	const isDirector = await ctx.runQuery(
		internal.admin.getIsDirectorInternal,
		{},
	);
	if (!isDirector) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "Directors only.",
		});
	}
}
