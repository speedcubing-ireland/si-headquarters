import { Section, Text } from "@react-email/components";
import {
	SponsorshipEmailShell,
	SponsorshipInfoBlock,
	formatDateTime,
} from "./sponsorshipShared";

export type SponsorshipAuctionActiveReminderEmailProps = {
	recipientName?: string;
	competitionName: string;
	endsAt: number;
	portalUrl: string;
	sponsorHasBid: boolean;
};

export default function SponsorshipAuctionActiveReminderEmail(
	props: SponsorshipAuctionActiveReminderEmailProps,
) {
	const greeting = props.recipientName
		? `Hi ${props.recipientName}, bidding`
		: "Bidding";
	const subtitle = `${greeting} for ${props.competitionName} sponsorship closes in approximately 1 hour.`;

	const bidStatus = props.sponsorHasBid
		? "You have a bid in place."
		: "You have not yet placed a bid.";

	const headerText = `${props.competitionName}: bidding closes in 1 hour`;

	return (
		<SponsorshipEmailShell
			preview={headerText}
			title={headerText}
			subtitle={subtitle}
			ctaLabel="View in portal"
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
				<Text className="m-0 mt-3 text-sm leading-5">{bidStatus}</Text>
				<Text className="m-0 mt-3 text-xs leading-5 text-brand-muted">
					Note: anti-sniping rules may extend the closing time if a bid is
					placed in the final minutes.
				</Text>
			</Section>
		</SponsorshipEmailShell>
	);
}

SponsorshipAuctionActiveReminderEmail.PreviewProps = {
	recipientName: "Sponsor Team",
	competitionName: "Irish Open 2026",
	endsAt: Date.now() + 60 * 60 * 1000,
	portalUrl: "https://hq.speedcubing.ie/sponsor/auctions",
	sponsorHasBid: true,
} satisfies SponsorshipAuctionActiveReminderEmailProps;
