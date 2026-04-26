import { render } from "@react-email/components";
import SponsorInviteEmail from "../emails/SponsorInviteEmail";
import SponsorshipInternalInvoiceEmail from "../emails/SponsorshipInternalInvoiceEmail";
import SponsorshipOutcomeEmail, {
	type SponsorshipOutcomeVariant,
} from "../emails/SponsorshipOutcomeEmail";
import SponsorshipScheduledEmail from "../emails/SponsorshipScheduledEmail";
import type { SponsorshipEmailType } from "./sponsorshipValidators";

export type SponsorshipEmailContext = {
	competitionName?: string;
	portalUrl?: string;
	adminUrl?: string;
	settlementAmountCents?: number;
	winnerSponsorName?: string;
	startsAt?: number;
	endsAt?: number;
	frameworkDescription?: string;
	startPriceCents?: number;
	currency?: string;
};

function resolveInviteTemplateData(
	context: SponsorshipEmailContext | undefined,
): { portalUrl: string } {
	return {
		portalUrl: context?.portalUrl ?? "https://hq.speedcubing.ie/sponsor/login",
	};
}

export async function buildSponsorshipEmailHtml(input: {
	emailType: SponsorshipEmailType;
	recipientName?: string;
	context?: SponsorshipEmailContext;
	messageFallback: string;
}): Promise<string> {
	if (input.emailType === "invite") {
		const inviteData = resolveInviteTemplateData(input.context);
		return render(
			<SponsorInviteEmail
				sponsorName={input.recipientName ?? "Sponsor"}
				portalUrl={inviteData.portalUrl}
			/>,
		);
	}

	if (input.emailType === "auction_scheduled") {
		if (input.context?.competitionName && input.context.portalUrl) {
			return render(
				<SponsorshipScheduledEmail
					recipientName={input.recipientName}
					competitionName={input.context.competitionName}
					startsAt={input.context.startsAt}
					endsAt={input.context.endsAt}
					frameworkDescription={input.context.frameworkDescription}
					startPriceCents={input.context.startPriceCents}
					currency={input.context.currency}
					portalUrl={input.context.portalUrl}
				/>,
			);
		}
	}

	if (
		input.emailType === "auction_started" ||
		input.emailType === "auction_winner" ||
		input.emailType === "auction_outbid" ||
		input.emailType === "auction_closed_none"
	) {
		if (input.context?.competitionName && input.context.portalUrl) {
			return render(
				<SponsorshipOutcomeEmail
					recipientName={input.recipientName}
					competitionName={input.context.competitionName}
					variant={input.emailType as SponsorshipOutcomeVariant}
					settlementAmountCents={input.context.settlementAmountCents}
					startsAt={input.context.startsAt}
					endsAt={input.context.endsAt}
					portalUrl={input.context.portalUrl}
				/>,
			);
		}
	}

	if (input.emailType === "internal_invoice") {
		if (input.context?.competitionName && input.context.adminUrl) {
			return render(
				<SponsorshipInternalInvoiceEmail
					competitionName={input.context.competitionName}
					winnerSponsorName={input.context.winnerSponsorName}
					settlementAmountCents={input.context.settlementAmountCents}
					adminUrl={input.context.adminUrl}
				/>,
			);
		}
	}

	return `<p>${input.messageFallback}</p>`;
}

export async function buildSponsorshipEmailPlainText(input: {
	emailType: SponsorshipEmailType;
	recipientName?: string;
	context?: SponsorshipEmailContext;
	messageFallback: string;
}): Promise<string> {
	if (input.emailType === "invite") {
		const inviteData = resolveInviteTemplateData(input.context);
		return render(
			<SponsorInviteEmail
				sponsorName={input.recipientName ?? "Sponsor"}
				portalUrl={inviteData.portalUrl}
			/>,
			{ plainText: true },
		);
	}

	if (input.emailType === "auction_scheduled") {
		if (input.context?.competitionName && input.context.portalUrl) {
			return render(
				<SponsorshipScheduledEmail
					recipientName={input.recipientName}
					competitionName={input.context.competitionName}
					startsAt={input.context.startsAt}
					endsAt={input.context.endsAt}
					frameworkDescription={input.context.frameworkDescription}
					startPriceCents={input.context.startPriceCents}
					currency={input.context.currency}
					portalUrl={input.context.portalUrl}
				/>,
				{ plainText: true },
			);
		}
	}

	if (
		input.emailType === "auction_started" ||
		input.emailType === "auction_winner" ||
		input.emailType === "auction_outbid" ||
		input.emailType === "auction_closed_none"
	) {
		if (input.context?.competitionName && input.context.portalUrl) {
			return render(
				<SponsorshipOutcomeEmail
					recipientName={input.recipientName}
					competitionName={input.context.competitionName}
					variant={input.emailType as SponsorshipOutcomeVariant}
					settlementAmountCents={input.context.settlementAmountCents}
					startsAt={input.context.startsAt}
					endsAt={input.context.endsAt}
					portalUrl={input.context.portalUrl}
				/>,
				{ plainText: true },
			);
		}
	}

	if (input.emailType === "internal_invoice") {
		if (input.context?.competitionName && input.context.adminUrl) {
			return render(
				<SponsorshipInternalInvoiceEmail
					competitionName={input.context.competitionName}
					winnerSponsorName={input.context.winnerSponsorName}
					settlementAmountCents={input.context.settlementAmountCents}
					adminUrl={input.context.adminUrl}
				/>,
				{ plainText: true },
			);
		}
	}

	return input.messageFallback;
}
