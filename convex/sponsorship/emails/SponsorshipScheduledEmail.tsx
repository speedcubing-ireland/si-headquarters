import { Section, Text } from "@react-email/components";
import { sponsorPortalAuctionsIndexUrl } from "../../lib/siteUrls";
import {
	SponsorshipEmailShell,
	SponsorshipInfoBlock,
	formatDateTime,
} from "./shared";

export type SponsorshipScheduledEmailProps = {
	recipientName?: string;
	competitionName: string;
	startsAt?: number;
	endsAt?: number;
	frameworkDescription?: string;
	startPriceCents?: number;
	currency?: string;
	portalUrl: string;
};

function formatPrice(cents: number, currency: string): string {
	return `${currency} ${(cents / 100).toFixed(2)}`;
}

export default function SponsorshipScheduledEmail(
	props: SponsorshipScheduledEmailProps,
) {
	const currency = props.currency ?? "EUR";
	const greeting = props.recipientName
		? `Hi ${props.recipientName}, bidding`
		: "Bidding";
	const subtitle = props.startsAt
		? `${greeting} for ${props.competitionName} sponsorship will open on ${formatDateTime(props.startsAt)}.`
		: `${greeting} for ${props.competitionName} sponsorship will open soon.`;

	return (
		<SponsorshipEmailShell
			preview={`${props.competitionName}: bidding opening soon`}
			title={`${props.competitionName}: : bidding opening soon`}
			subtitle={subtitle}
			ctaLabel="View in portal"
			ctaUrl={props.portalUrl}
		>
			<Section>
				<SponsorshipInfoBlock
					label="Competition"
					value={props.competitionName}
				/>
				{props.startsAt !== undefined ? (
					<Section className="mt-3">
						<SponsorshipInfoBlock
							label="Bidding opens"
							value={formatDateTime(props.startsAt)}
						/>
					</Section>
				) : null}
				{props.endsAt !== undefined ? (
					<Section className="mt-3">
						<SponsorshipInfoBlock
							label="Bidding closes"
							value={formatDateTime(props.endsAt)}
						/>
					</Section>
				) : null}
				{props.frameworkDescription ? (
					<Section className="mt-3">
						<SponsorshipInfoBlock
							label="Auction format"
							value={props.frameworkDescription}
						/>
					</Section>
				) : null}
				{props.startPriceCents !== undefined ? (
					<Section className="mt-3">
						<SponsorshipInfoBlock
							label="Starting price"
							value={formatPrice(props.startPriceCents, currency)}
						/>
					</Section>
				) : null}
				<Text className="m-0 mt-3 text-xs leading-5 text-brand-muted">
					You will receive another email when bidding opens. You can also check
					the sponsor portal at any time.
				</Text>
			</Section>
		</SponsorshipEmailShell>
	);
}

SponsorshipScheduledEmail.PreviewProps = {
	recipientName: "Sponsor Team",
	competitionName: "Irish Open 2026",
	startsAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
	endsAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
	frameworkDescription:
		"This is a sealed-bid auction. All bids are hidden. The highest bidder wins and pays their bid amount.",
	startPriceCents: 10_000,
	currency: "EUR",
	portalUrl: sponsorPortalAuctionsIndexUrl(),
} satisfies SponsorshipScheduledEmailProps;
