import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { SponsorshipEmailContext } from "../lib/sponsorshipEmailTemplates";
import type { SponsorshipEmailType } from "../lib/sponsorshipValidators";

type SponsorshipEmailRecipient = {
	sponsorId?: Id<"sponsors">;
	email: string;
	name?: string;
};

type EnqueueSponsorshipEmailBatchArgs = {
	batchKey: string;
	auctionId?: Id<"sponsorshipAuctions">;
	emailType: SponsorshipEmailType;
	subject: string;
	message: string;
	recipients: SponsorshipEmailRecipient[];
	context?: SponsorshipEmailContext;
	forceResend?: boolean;
};

function requireEmailRecipients(recipients: { email: string }[]): void {
	if (recipients.length === 0) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "No recipients specified for sponsorship email batch.",
		});
	}
}

export async function enqueueSponsorshipEmailBatch(
	ctx: MutationCtx,
	args: EnqueueSponsorshipEmailBatchArgs,
): Promise<void> {
	requireEmailRecipients(args.recipients);
	await ctx.scheduler.runAfter(
		0,
		internal.sponsorshipNode._enqueueSponsorshipEmailBatch,
		args,
	);
}
