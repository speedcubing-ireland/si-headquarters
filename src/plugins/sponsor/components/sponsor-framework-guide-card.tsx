import type { SponsorshipFramework } from "@/plugins/sponsor/lib/sponsorship-ui";
import {
	sponsorshipFrameworkGuide,
	sponsorshipFrameworkLabel,
} from "@/plugins/sponsor/lib/sponsorship-ui";

function GuideBulletList({
	title,
	items,
}: {
	title: string;
	items: readonly string[];
}) {
	if (items.length === 0) return null;
	return (
		<div className="space-y-1">
			<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{title}
			</p>
			<ul className="space-y-1 text-sm text-muted-foreground">
				{items.map((item) => (
					<li key={item} className="flex items-start gap-1.5">
						<span className="mt-0.5 text-foreground">•</span>
						<span>{item}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

export function SponsorFrameworkGuideCard({
	framework,
	compact = false,
}: {
	framework: SponsorshipFramework;
	compact?: boolean;
}) {
	const guide = sponsorshipFrameworkGuide(framework);
	return (
		<div
			className={
				compact
					? "rounded-lg border bg-muted/20 p-3"
					: "rounded-lg border bg-card p-4 shadow-sm"
			}
		>
			<div className="space-y-1">
				<p className="font-medium">{sponsorshipFrameworkLabel(framework)}</p>
				<p className="text-sm text-muted-foreground">{guide.tagline}</p>
			</div>
			<p
				className={
					compact
						? "mt-2 text-sm text-muted-foreground"
						: "mt-3 text-sm leading-relaxed"
				}
			>
				{guide.summary}
			</p>
			<div className={compact ? "mt-3 space-y-3" : "mt-4 grid gap-4 sm:grid-cols-2"}>
				<GuideBulletList title="Bidding" items={guide.bidding} />
				<GuideBulletList title="Closing" items={guide.closing} />
			</div>
			{guide.notes !== undefined && guide.notes.length > 0 ? (
				<div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
					<GuideBulletList title="Good to know" items={guide.notes} />
				</div>
			) : null}
		</div>
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
