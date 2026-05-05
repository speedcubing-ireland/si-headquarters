import { Link, Section, Text } from "@react-email/components";
import { sponsorPortalLoginUrl } from "../lib/siteUrls";
import { SponsorshipEmailShell } from "./sponsorshipShared";

export type SponsorInviteEmailProps = {
	sponsorName: string;
	portalUrl: string;
};

export default function SponsorInviteEmail(props: SponsorInviteEmailProps) {
	return (
		<SponsorshipEmailShell
			preview="Sponsor portal access details"
			title="Sponsor Portal Access"
			subtitle={`Hi ${props.sponsorName}, your sponsor portal account is ready.`}
			ctaLabel="Open Sponsor Portal"
			ctaUrl={props.portalUrl}
		>
			<Section className="rounded-lg bg-brand-cream px-4 py-3">
				<Text className="m-0 text-xs text-brand-muted">Getting started</Text>
				<Text className="m-0 mt-1 text-sm leading-6 text-brand-foreground">
					1) Open the sponsor portal using the button below.
				</Text>
				<Text className="m-0 mt-1 text-sm leading-6 text-brand-foreground">
					2) Sign in using a one-time email code or by resetting your password.
				</Text>
			</Section>
			<Section className="mt-3 rounded-lg border border-brand-border px-4 py-3">
				<Text className="m-0 text-xs text-brand-muted">Portal URL</Text>
				<Text className="m-0 mt-1 text-xs leading-5 text-brand-foreground wrap-anywhere">
					<Link href={props.portalUrl}>{props.portalUrl}</Link>
				</Text>
				<Text className="m-0 mt-2 text-xs leading-5 text-brand-muted">
					You can reuse this link for future bids.
				</Text>
			</Section>
		</SponsorshipEmailShell>
	);
}

SponsorInviteEmail.PreviewProps = {
	sponsorName: "Example Sponsor",
	portalUrl: sponsorPortalLoginUrl(),
} satisfies SponsorInviteEmailProps;
