import type { SponsorshipFramework } from "@/plugins/sponsor/lib/sponsorship-ui";
import {
	sponsorshipFrameworkGuide,
	sponsorshipFrameworkLabel,
} from "@/plugins/sponsor/lib/sponsorship-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

function GuideBulletList({
	title,
	items,
}: {
	title: string;
	items: readonly string[];
}) {
	if (items.length === 0) return null;
	return (
		<div className="space-y-2">
			<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{title}
			</p>
			<ul className="space-y-1.5 text-sm text-muted-foreground">
				{items.map((item) => (
					<li key={item} className="flex items-start gap-2">
						<span className="mt-2 size-1 shrink-0 rounded-full bg-foreground/50" />
						<span>{item}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function SponsorFrameworkGuideBody({
	framework,
	compact,
}: {
	framework: SponsorshipFramework;
	compact: boolean;
}) {
	const guide = sponsorshipFrameworkGuide(framework);
	return (
		<>
			<p className="text-sm leading-relaxed">{guide.summary}</p>
			<div
				className={
					compact ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"
				}
			>
				<GuideBulletList title="Bidding" items={guide.bidding} />
				<GuideBulletList title="Closing" items={guide.closing} />
			</div>
			{guide.notes !== undefined && guide.notes.length > 0 ? (
				<Alert>
					<AlertTitle>Good to know</AlertTitle>
					<AlertDescription>
						<ul className="space-y-2">
							{guide.notes.map((note) => (
								<li key={note}>{note}</li>
							))}
						</ul>
					</AlertDescription>
				</Alert>
			) : null}
		</>
	);
}

export function SponsorFrameworkGuideCard({
	framework,
	compact = false,
	embedded = false,
}: {
	framework: SponsorshipFramework;
	compact?: boolean;
	/** Render body only (e.g. inside another Card's tabs). */
	embedded?: boolean;
}) {
	const guide = sponsorshipFrameworkGuide(framework);

	if (embedded) {
		return (
			<div className="space-y-4">
				<p className="text-sm text-muted-foreground">{guide.tagline}</p>
				<SponsorFrameworkGuideBody framework={framework} compact={compact} />
			</div>
		);
	}

	return (
		<Card size={compact ? "sm" : "default"}>
			<CardHeader>
				<CardTitle>{sponsorshipFrameworkLabel(framework)}</CardTitle>
				<CardDescription>{guide.tagline}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<SponsorFrameworkGuideBody framework={framework} compact={compact} />
			</CardContent>
		</Card>
	);
}

export function SponsorFrameworkGuideGrid() {
	const frameworks: SponsorshipFramework[] = [
		"first_sealed",
		"vickrey",
		"ebay_proxy",
	];
	return (
		<div className="grid gap-4 lg:grid-cols-3">
			{frameworks.map((framework) => (
				<SponsorFrameworkGuideCard key={framework} framework={framework} compact />
			))}
		</div>
	);
}
