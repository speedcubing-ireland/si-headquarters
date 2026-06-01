import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SponsorFrameworkGuideGrid } from "@/plugins/sponsor/components/sponsor-framework-guide-card";
import {
	sponsorshipFrameworkGuide,
	type SponsorshipFramework,
} from "@/plugins/sponsor/lib/sponsorship-ui";

export function AuctionBiddingHelpOverview() {
	return <SponsorFrameworkGuideGrid />;
}

export function AuctionBiddingHelpAlert(props: {
	framework: SponsorshipFramework;
}) {
	const guide = sponsorshipFrameworkGuide(props.framework);
	return (
		<Alert className="border-primary/30 bg-primary/5">
			<Info className="size-4" />
			<AlertTitle>{guide.title}</AlertTitle>
			<AlertDescription className="space-y-3">
				<p className="text-muted-foreground">{guide.tagline}</p>
				<p>{guide.summary}</p>
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="space-y-1">
						<p className="text-xs font-medium uppercase tracking-wide">Bidding</p>
						<ul className="space-y-1">
							{guide.bidding.map((rule) => (
								<li key={rule} className="flex items-start gap-1.5">
									<span className="mt-0.5">•</span>
									<span>{rule}</span>
								</li>
							))}
						</ul>
					</div>
					<div className="space-y-1">
						<p className="text-xs font-medium uppercase tracking-wide">Closing</p>
						<ul className="space-y-1">
							{guide.closing.map((rule) => (
								<li key={rule} className="flex items-start gap-1.5">
									<span className="mt-0.5">•</span>
									<span>{rule}</span>
								</li>
							))}
						</ul>
					</div>
				</div>
				{guide.notes !== undefined && guide.notes.length > 0 ? (
					<div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
						<p className="text-xs font-medium uppercase tracking-wide">
							Good to know
						</p>
						<ul className="space-y-1">
							{guide.notes.map((note) => (
								<li key={note} className="flex items-start gap-1.5">
									<span className="mt-0.5">•</span>
									<span>{note}</span>
								</li>
							))}
						</ul>
					</div>
				) : null}
			</AlertDescription>
		</Alert>
	);
}
