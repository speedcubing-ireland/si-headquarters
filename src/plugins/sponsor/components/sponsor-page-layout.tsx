import { cn } from "@/lib/utils";

export function SponsorPageShell({
	children,
	maxWidthClassName = "max-w-6xl",
}: {
	children: React.ReactNode;
	maxWidthClassName?: string;
}) {
	return (
		<div className="min-h-svh bg-gradient-to-b from-muted/40 to-background px-4 py-4 sm:px-6">
			<div className={cn("mx-auto w-full space-y-4", maxWidthClassName)}>
				{children}
			</div>
		</div>
	);
}

export function SponsorPageHeader({
	title,
	subtitle,
	eyebrow = "Sponsor Portal",
	actions,
}: {
	title: string;
	subtitle?: string;
	eyebrow?: string;
	actions?: React.ReactNode;
}) {
	return (
		<header className="flex min-h-14 flex-wrap items-center justify-between gap-3">
			<div className="min-w-0">
				<p className="text-xs uppercase tracking-wide text-muted-foreground">
					{eyebrow}
				</p>
				<h1 className="truncate text-2xl font-semibold">{title}</h1>
				{subtitle !== undefined && subtitle.length > 0 ? (
					<p className="text-sm text-muted-foreground">{subtitle}</p>
				) : null}
			</div>
			{actions != null ? (
				<div className="flex items-center gap-2">{actions}</div>
			) : null}
		</header>
	);
}
