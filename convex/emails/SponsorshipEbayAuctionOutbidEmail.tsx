import { Section, Text } from "@react-email/components";
import {
	SponsorshipEmailShell,
	SponsorshipInfoBlock,
	formatDateTime,
} from "./sponsorshipShared";

export type SponsorshipEbayAuctionOutbidEmailProps = {
	recipientName?: string;
	competitionName: string;
	endsAt: number;
	portalUrl: string;
};

export default function SponsorshipEbayAuctionOutbidEmail(
	props: SponsorshipEbayAuctionOutbidEmailProps,
) {
	const headerText = `${props.competitionName}: you have been outbid`;
	const greeting = props.recipientName
		? `Hi ${props.recipientName}, you`
		: "You";
	const subtitle = `${greeting} have been outbid in the sponsorship auction for ${props.competitionName}.`;

	return (
		<SponsorshipEmailShell
			preview={headerText}
			title={headerText}
			subtitle={subtitle}
			ctaLabel="Place a new bid"
			ctaUrl={props.portalUrl}
		>
			<Section>
				<SponsorshipInfoBlock
					label="Competition"
					value={props.competitionName}
				/>
				<Section className="mt-3">
					<SponsorshipInfoBlock
						label="Bidding closes"
						value={formatDateTime(props.endsAt)}
					/>
				</Section>
				<Text className="m-0 mt-3 text-sm leading-5">
					Place a new bid to stay in contention.
				</Text>
				<Text className="m-0 mt-3 text-xs leading-5 text-brand-muted">
					Note: anti-sniping rules may extend the closing time if a bid is
					placed in the final minutes.
				</Text>
			</Section>
		</SponsorshipEmailShell>
	);
}

SponsorshipEbayAuctionOutbidEmail.PreviewProps = {
	recipientName: "Sponsor Team",
	competitionName: "Irish Open 2026",
	endsAt: Date.now() + 60 * 60 * 1000,
	portalUrl: "https://hq.speedcubing.ie/sponsor/auctions",
} satisfies SponsorshipEbayAuctionOutbidEmailProps;
