import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	SPONSORSHIP_FRAMEWORKS,
	sponsorshipFrameworkGuide,
	sponsorshipFrameworkLabel,
	type SponsorshipFramework,
} from "@/lib/sponsorship-ui";

export function AuctionBiddingHelpOverview() {
	return (
		<div className="grid gap-3 md:grid-cols-3">
			{SPONSORSHIP_FRAMEWORKS.map((framework) => {
				const guide = sponsorshipFrameworkGuide(framework);
				return (
					<div
						key={framework}
						className="rounded-lg border bg-muted/20 p-3 text-sm"
					>
						<p className="font-medium">
							{sponsorshipFrameworkLabel(framework)}
						</p>
						<p className="mt-1 text-muted-foreground">{guide.summary}</p>
						<ul className="mt-2 space-y-1 text-xs text-muted-foreground">
							{guide.rules.map((rule) => (
								<li key={rule} className="flex items-start gap-1.5">
									<span className="mt-0.5 text-foreground">•</span>
									<span>{rule}</span>
								</li>
							))}
						</ul>
					</div>
				);
			})}
		</div>
	);
}

export function AuctionBiddingHelpAlert(props: {
	framework: SponsorshipFramework;
}) {
	const guide = sponsorshipFrameworkGuide(props.framework);
	return (
		<Alert className="border-primary/30 bg-primary/5">
			<Info className="size-4" />
			<AlertTitle>{guide.title}</AlertTitle>
			<AlertDescription className="space-y-2">
				<p>{guide.summary}</p>
				<ul className="space-y-1">
					{guide.rules.map((rule) => (
						<li key={rule} className="flex items-start gap-1.5">
							<span className="mt-0.5 text-foreground">•</span>
							<span>{rule}</span>
						</li>
					))}
				</ul>
			</AlertDescription>
		</Alert>
	);
}
