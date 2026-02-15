import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { enqueueDispatch } from "../emailQueue/enqueue";
import { normalizeEmail } from "../lib/sanitize";
import {
	buildSponsorshipEmailHtml,
	buildSponsorshipEmailPlainText,
	type SponsorshipEmailContext,
} from "../lib/sponsorshipEmailTemplates";
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

function buildDispatchDedupeKey(args: {
	batchKey: string;
	emailType: SponsorshipEmailType;
	recipient: string;
}): string {
	return `${args.batchKey}:${args.emailType}:${normalizeEmail(args.recipient)}`;
}

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
): Promise<{ queued: number; skipped: number }> {
	requireEmailRecipients(args.recipients);
	let queued = 0;
	let skipped = 0;

	for (const recipient of args.recipients) {
		const recipientEmail = normalizeEmail(recipient.email);
		if (!recipientEmail) {
			skipped += 1;
			continue;
		}

		const dedupeKey = buildDispatchDedupeKey({
			batchKey: args.batchKey,
			emailType: args.emailType,
			recipient: recipientEmail,
		});

		const [htmlBody, plainTextBody] = await Promise.all([
			buildSponsorshipEmailHtml({
				emailType: args.emailType,
				recipientName: recipient.name,
				context: args.context,
				messageFallback: args.message,
			}),
			buildSponsorshipEmailPlainText({
				emailType: args.emailType,
				recipientName: recipient.name,
				context: args.context,
				messageFallback: args.message,
			}),
		]);

		const result = await enqueueDispatch(ctx, {
			dedupeKey,
			sourceKind: "sponsorship",
			sourceRef: args.auctionId ? `${args.auctionId}` : undefined,
			templateKey: args.emailType,
			recipientEmail,
			recipientName: recipient.name,
			subject: args.subject,
			htmlBody,
			plainTextBody,
			payloadJson: args.context ? JSON.stringify(args.context) : undefined,
			forceResend: args.forceResend,
		});
		if (result.created) {
			queued += 1;
		} else {
			skipped += 1;
		}
	}

	return { queued, skipped };
}
