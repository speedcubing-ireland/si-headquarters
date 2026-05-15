import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import {
	isSponsorshipManagerForCtx,
	requirePermission,
	PERMISSION_KEYS,
} from "../../lib/permissions/policies";

type Ctx = QueryCtx | MutationCtx;

export async function isSponsorshipManager(ctx: Ctx): Promise<boolean> {
	return isSponsorshipManagerForCtx(ctx);
}

export async function requireSponsorshipManager(
	ctx: Ctx,
): Promise<Id<"users">> {
	return requirePermission(ctx, PERMISSION_KEYS.SPONSORSHIP_MANAGER);
}
