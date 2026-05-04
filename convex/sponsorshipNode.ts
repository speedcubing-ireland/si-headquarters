"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
	buildSponsorshipEmailHtml,
	buildSponsorshipEmailPlainText,
} from "./lib/sponsorshipEmailTemplates";
import { getSponsorshipSenderAddress } from "./lib/email";
import { normalizeEmail } from "./lib/sanitize";
import { sponsorshipEmailType } from "./lib/sponsorshipValidators";

const sponsorshipEmailRecipientValidator = v.object({
	sponsorId: v.optional(v.id("sponsors")),
	email: v.string(),
	name: v.optional(v.string()),
});

const sponsorshipEmailContextValidator = v.object({
	competitionName: v.optional(v.string()),
	portalUrl: v.optional(v.string()),
	adminUrl: v.optional(v.string()),
	settlementAmountCents: v.optional(v.number()),
	winnerSponsorName: v.optional(v.string()),
	startsAt: v.optional(v.number()),
	endsAt: v.optional(v.number()),
	frameworkDescription: v.optional(v.string()),
	startPriceCents: v.optional(v.number()),
	currency: v.optional(v.string()),
	sponsorHasBid: v.optional(v.boolean()),
});

function buildDispatchDedupeKey(args: {
	batchKey: string;
	emailType: string;
	recipient: string;
}): string {
	return `${args.batchKey}:${args.emailType}:${normalizeEmail(args.recipient)}`;
}

export const _enqueueSponsorshipEmailBatch = internalAction({
	args: {
		batchKey: v.string(),
		auctionId: v.optional(v.id("sponsorshipAuctions")),
		emailType: sponsorshipEmailType,
		subject: v.string(),
		message: v.string(),
		recipients: v.array(sponsorshipEmailRecipientValidator),
		context: v.optional(sponsorshipEmailContextValidator),
		forceResend: v.optional(v.boolean()),
	},
	returns: v.object({
		queued: v.number(),
		skipped: v.number(),
	}),
	handler: async (ctx, args) => {
		if (args.recipients.length === 0) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "No recipients specified for sponsorship email batch.",
			});
		}

		let queued = 0;
		let skipped = 0;
		for (const recipient of args.recipients) {
			const recipientEmail = normalizeEmail(recipient.email);
			if (!recipientEmail) {
				skipped += 1;
				continue;
			}

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

			const result = await ctx.runMutation(
				internal.emailQueue._enqueueDispatch,
				{
					dedupeKey: buildDispatchDedupeKey({
						batchKey: args.batchKey,
						emailType: args.emailType,
						recipient: recipientEmail,
					}),
					sourceKind: "sponsorship",
					sourceRef: args.auctionId ? `${args.auctionId}` : undefined,
					templateKey: args.emailType,
					recipientEmail,
					recipientName: recipient.name,
					senderAddress: getSponsorshipSenderAddress(),
					subject: args.subject,
					htmlBody,
					plainTextBody,
					payloadJson: args.context ? JSON.stringify(args.context) : undefined,
					forceResend: args.forceResend,
				},
			);
			if (result.created) {
				queued += 1;
			} else {
				skipped += 1;
			}
		}
		return { queued, skipped };
	},
});
