import { Crons } from "@convex-dev/crons";
import { components, internal } from "../../_generated/api";
import type { MutationCtx } from "../../_generated/server";

const crons = new Crons(components.crons);

const LIFECYCLE_CRON_NAME = "sponsorship-auctions-lifecycle";
const LIFECYCLE_CRON_INTERVAL_MS = 60_000;

function hasErrorMessage(error: unknown, message: string): boolean {
	return error instanceof Error && error.message.includes(message);
}

async function hasOpenLifecycleAuctions(ctx: MutationCtx): Promise<boolean> {
	const [scheduled, active] = await Promise.all([
		ctx.db
			.query("sponsorshipAuctions")
			.withIndex("by_state_and_start", (q) => q.eq("state", "scheduled"))
			.take(1),
		ctx.db
			.query("sponsorshipAuctions")
			.withIndex("by_state_and_end", (q) => q.eq("state", "active"))
			.take(1),
	]);
	return scheduled.length > 0 || active.length > 0;
}

export async function syncLifecycleRuntimeCron(
	ctx: MutationCtx,
): Promise<void> {
	const [shouldRunLifecycle, existingCron] = await Promise.all([
		hasOpenLifecycleAuctions(ctx),
		crons.get(ctx, { name: LIFECYCLE_CRON_NAME }),
	]);

	if (shouldRunLifecycle) {
		if (existingCron) return;
		try {
			await crons.register(
				ctx,
				{ kind: "interval", ms: LIFECYCLE_CRON_INTERVAL_MS },
				internal.sponsorshipAuctions._tickLifecycle,
				{},
				LIFECYCLE_CRON_NAME,
			);
		} catch (error) {
			if (hasErrorMessage(error, "already exists")) return;
			throw error;
		}
		return;
	}

	if (!existingCron) return;
	try {
		await crons.delete(ctx, { name: LIFECYCLE_CRON_NAME });
	} catch (error) {
		if (hasErrorMessage(error, "not found")) return;
		throw error;
	}
}
