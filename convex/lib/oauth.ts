import type { DataModel } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { GenericActionCtx } from "convex/server";
import { ConvexError } from "convex/values";

function hasValidCliToken(cliToken: string | undefined): boolean {
	if (!cliToken) return false;
	const expectedToken = process.env.CLI_AUTH_TOKEN;
	return Boolean(expectedToken && cliToken === expectedToken);
}

function throwInvalidCliToken(): never {
	throw new ConvexError({
		code: "UNAUTHENTICATED",
		message: "Invalid CLI token",
	});
}

export async function requireVolunteerAction(
	ctx: GenericActionCtx<DataModel>,
	cliToken?: string,
): Promise<void> {
	if (hasValidCliToken(cliToken)) return;
	if (cliToken) throwInvalidCliToken();
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
	if (cliToken) throwInvalidCliToken();
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

export async function requireDirectorOrVolunteerAction(
	ctx: GenericActionCtx<DataModel>,
	cliToken?: string,
): Promise<void> {
	if (hasValidCliToken(cliToken)) return;
	if (cliToken) throwInvalidCliToken();

	const [isDirector, isVolunteer] = await Promise.all([
		ctx.runQuery(internal.admin.getIsDirectorInternal, {}),
		ctx.runQuery(internal.auth.getIsVolunteer, {}),
	]);

	if (!isDirector && !isVolunteer) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "Directors or volunteers only.",
		});
	}
}

export async function requireDirectorOrDelegateAction(
	ctx: GenericActionCtx<DataModel>,
	cliToken?: string,
): Promise<void> {
	if (hasValidCliToken(cliToken)) return;
	if (cliToken) throwInvalidCliToken();

	const [isDirector, isDelegate] = await Promise.all([
		ctx.runQuery(internal.admin.getIsDirectorInternal, {}),
		ctx.runQuery(internal.admin.getIsDelegateInternal, {}),
	]);

	if (!isDirector && !isDelegate) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "Directors or delegates only.",
		});
	}
}
