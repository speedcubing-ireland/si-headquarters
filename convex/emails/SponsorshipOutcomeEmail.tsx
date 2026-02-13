import { Section, Text } from "@react-email/components";
import {
	SponsorshipEmailShell,
	SponsorshipInfoBlock,
} from "./sponsorshipShared";

export type SponsorshipOutcomeVariant =
	| "auction_started"
	| "auction_winner"
	| "auction_outbid"
	| "auction_closed_none";

export type SponsorshipOutcomeEmailProps = {
	recipientName?: string;
	competitionName: string;
	variant: SponsorshipOutcomeVariant;
	settlementAmountCents?: number;
	startsAt?: number;
	endsAt?: number;
	portalUrl: string;
};

function getCopy(props: SponsorshipOutcomeEmailProps): {
	title: string;
	preview: string;
	body: string;
	ctaLabel: string;
	statusLabel: string;
} {
	switch (props.variant) {
		case "auction_started":
			return {
				title: `${props.competitionName} sponsorship is open`,
				preview: "Sponsorship bidding has started",
				body:
					props.endsAt !== undefined
						? `Bidding is now live. Submit your bid before ${new Date(props.endsAt).toLocaleString()}.`
						: "Bidding is now live in the sponsor portal.",
				ctaLabel: "Open auction",
				statusLabel: "Bidding open",
			};
		case "auction_winner":
			return {
				title: `You won ${props.competitionName}`,
				preview: "You are the winning sponsor",
				body:
					props.settlementAmountCents !== undefined
						? `Congratulations. Your winning settlement is EUR ${(props.settlementAmountCents / 100).toFixed(2)}. Finance will follow up with invoice details.`
						: "Congratulations. You are the confirmed sponsor. Finance will follow up with invoice details.",
				ctaLabel: "View result",
				statusLabel: "Winner confirmed",
			};
		case "auction_outbid":
			return {
				title: `${props.competitionName} bidding closed`,
				preview: "Auction has closed",
				body: "This sponsorship auction has now closed. Thank you for participating.",
				ctaLabel: "View outcome",
				statusLabel: "Auction closed",
			};
		case "auction_closed_none":
			return {
				title: `${props.competitionName} closed with no winner`,
				preview: "Auction closed without a winner",
				body: "This sponsorship auction closed without a winning bid.",
				ctaLabel: "View auction",
				statusLabel: "No winner",
			};
	}
}

export default function SponsorshipOutcomeEmail(
	props: SponsorshipOutcomeEmailProps,
) {
	const copy = getCopy(props);
	return (
		<SponsorshipEmailShell
			preview={copy.preview}
			title={copy.title}
			subtitle={
				props.recipientName
					? `Hi ${props.recipientName}, ${copy.body}`
					: copy.body
			}
			ctaLabel={copy.ctaLabel}
			ctaUrl={props.portalUrl}
		>
			<Section>
				<SponsorshipInfoBlock
					label="Competition"
					value={props.competitionName}
				/>
				<Section className="mt-3">
					<SponsorshipInfoBlock label="Status" value={copy.statusLabel} />
				</Section>
				{props.settlementAmountCents !== undefined ? (
					<Section className="mt-3">
						<SponsorshipInfoBlock
							label="Settlement"
							value={`EUR ${(props.settlementAmountCents / 100).toFixed(2)}`}
						/>
					</Section>
				) : null}
				{props.startsAt !== undefined ? (
					<Section className="mt-3">
						<SponsorshipInfoBlock
							label="Starts"
							value={new Date(props.startsAt).toLocaleString()}
						/>
					</Section>
				) : null}
				{props.endsAt !== undefined ? (
					<Section className="mt-3">
						<SponsorshipInfoBlock
							label="Ends"
							value={new Date(props.endsAt).toLocaleString()}
						/>
					</Section>
				) : null}
				<Text className="m-0 mt-3 text-xs leading-5 text-brand-muted">
					You can revisit this auction at any time in the sponsor portal.
				</Text>
			</Section>
		</SponsorshipEmailShell>
	);
}

SponsorshipOutcomeEmail.PreviewProps = {
	recipientName: "Sponsor Team",
	competitionName: "Irish Open 2026",
	variant: "auction_winner",
	settlementAmountCents: 125000,
	portalUrl: "https://hq.speedcubing.ie/sponsor/auctions",
} satisfies SponsorshipOutcomeEmailProps;
