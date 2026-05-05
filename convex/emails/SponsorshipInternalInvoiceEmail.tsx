import { Hr, Section, Text } from "@react-email/components";
import { sponsorshipAdminPageUrl } from "../lib/siteUrls";
import {
	SponsorshipEmailShell,
	SponsorshipInfoBlock,
} from "./sponsorshipShared";

export type SponsorshipInternalInvoiceEmailProps = {
	competitionName: string;
	winnerSponsorName?: string;
	settlementAmountCents?: number;
	adminUrl: string;
	message?: string;
};

export default function SponsorshipInternalInvoiceEmail(
	props: SponsorshipInternalInvoiceEmailProps,
) {
	const hasWinner = Boolean(props.winnerSponsorName);
	const outcomeLabel = hasWinner ? "Winner confirmed" : "No winner";
	const outcomeValue = hasWinner
		? (props.winnerSponsorName ?? "Unknown sponsor")
		: "No winning sponsor";

	return (
		<SponsorshipEmailShell
			preview={`${props.competitionName} sponsorship outcome`}
			title="Invoice Follow-up Required"
			subtitle="Please review the sponsorship outcome and complete finance follow-up in HQ."
			ctaLabel="Open Sponsorship Admin"
			ctaUrl={props.adminUrl}
		>
			<Section>
				<SponsorshipInfoBlock
					label="Competition"
					value={props.competitionName}
				/>
				<Section className="mt-3">
					<SponsorshipInfoBlock label={outcomeLabel} value={outcomeValue} />
				</Section>
				{props.settlementAmountCents !== undefined ? (
					<Section className="mt-3">
						<SponsorshipInfoBlock
							label="Winning bid"
							value={`EUR ${(props.settlementAmountCents / 100).toFixed(2)}`}
						/>
					</Section>
				) : null}
				{props.message ? (
					<Section className="mt-3">
						<Hr className="border-brand-border" />
						<Text className="m-0 mt-3 text-sm font-medium text-brand-foreground">
							{props.message}
						</Text>
					</Section>
				) : null}
				{hasWinner ? (
					<Section className="mt-3 rounded-lg border border-brand-border px-4 py-3">
						<Text className="m-0 text-xs text-brand-muted">Next steps</Text>
						<Text className="m-0 mt-1 text-sm leading-6 text-brand-foreground">
							1) Confirm sponsorship status on the competition record.
						</Text>
						<Text className="m-0 mt-1 text-sm leading-6 text-brand-foreground">
							2) Send invoice and payment instructions.
						</Text>
						<Text className="m-0 mt-1 text-sm leading-6 text-brand-foreground">
							3) Record follow-up actions in HQ.
						</Text>
					</Section>
				) : null}
			</Section>
		</SponsorshipEmailShell>
	);
}

SponsorshipInternalInvoiceEmail.PreviewProps = {
	competitionName: "Irish Open 2026",
	winnerSponsorName: "Example Sponsor",
	settlementAmountCents: 125000,
	adminUrl: sponsorshipAdminPageUrl(),
	message:
		"Winner confirmed: Example Sponsor at EUR 1250.00. Send invoice follow-up.",
} satisfies SponsorshipInternalInvoiceEmailProps;
