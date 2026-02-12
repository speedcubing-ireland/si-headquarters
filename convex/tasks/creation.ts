import { ConvexError } from "convex/values";
import { decodeApprovalId } from "../taskApprovals";
import type { MutationCtx } from "../_generated/server";

export function assertValidApprovalIds(requiredApprovalIds: string[]): void {
	for (const id of requiredApprovalIds) {
		if (decodeApprovalId(id) !== null) {
			continue;
		}
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: `Invalid approval ID format: ${id}`,
		});
	}
}

export async function nextTaskIdentifier(ctx: MutationCtx): Promise<string> {
	const counter = await ctx.db.query("taskCounter").first();
	if (!counter) {
		await ctx.db.insert("taskCounter", { next: 2 });
		return "HQ-1";
	}

	const nextNum = counter.next;
	await ctx.db.patch("taskCounter", counter._id, { next: nextNum + 1 });
	return `HQ-${nextNum}`;
}

export async function reserveTaskIdentifiers(
	ctx: MutationCtx,
	count: number,
): Promise<string[]> {
	if (count <= 0) return [];

	const counter = await ctx.db.query("taskCounter").first();
	if (!counter) {
		await ctx.db.insert("taskCounter", { next: count + 1 });
		return Array.from({ length: count }, (_, index) => `HQ-${index + 1}`);
	}

	const start = counter.next;
	await ctx.db.patch("taskCounter", counter._id, { next: start + count });
	return Array.from({ length: count }, (_, index) => `HQ-${start + index}`);
}
