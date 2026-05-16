import { ExternalLink, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type DetailStatTone = "neutral" | "positive" | "warning" | "danger";

export function DetailSummaryStat({
	label,
	value,
	tone = "neutral",
}: {
	label: string;
	value: string;
	tone?: DetailStatTone;
}) {
	const toneClass =
		tone === "positive"
			? "text-success"
			: tone === "warning"
				? "text-warning"
				: tone === "danger"
					? "text-destructive"
					: "text-foreground";

	return (
		<div className="rounded-lg border bg-card px-3 py-3">
			<div className="text-[11px] uppercase tracking-wide text-muted-foreground">
				{label}
			</div>
			<div className={cn("mt-1 text-lg font-semibold", toneClass)}>{value}</div>
		</div>
	);
}

export function DetailSection({
	title,
	description,
	children,
	className,
}: {
	title: string;
	description?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={cn("rounded-lg border bg-card p-4 sm:p-5", className)}>
			<div className="mb-4 flex items-start justify-between gap-3">
				<div>
					<h2 className="text-sm font-semibold tracking-tight">{title}</h2>
					{description ? (
						<p className="mt-1 text-sm text-muted-foreground">{description}</p>
					) : null}
				</div>
			</div>
			{children}
		</section>
	);
}

export function DetailInfoRow({
	label,
	children,
	icon,
}: {
	label: string;
	children: ReactNode;
	icon?: ReactNode;
}) {
	return (
		<div className="rounded-md border bg-muted/20 px-3 py-3">
			<div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{icon}
				<span>{label}</span>
			</div>
			<div className="min-w-0">{children}</div>
		</div>
	);
}

export function DetailResourceTile({
	label,
	description,
	icon,
	href,
	onRemove,
}: {
	label: string;
	description: string;
	icon: ReactNode;
	href: string;
	onRemove?: () => void;
}) {
	return (
		<div className="rounded-md border bg-muted/20 p-3">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-start gap-3">
					<div className="mt-0.5 rounded-md border bg-background p-2">
						{icon}
					</div>
					<div className="min-w-0">
						<div className="truncate font-medium">{label}</div>
						<div className="truncate text-sm text-muted-foreground">
							{description}
						</div>
					</div>
				</div>
				{onRemove ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon-xs" className="shrink-0">
								<MoreHorizontal className="size-4" />
								<span className="sr-only">Open actions</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-40">
							<DropdownMenuItem asChild>
								<a href={href} target="_blank" rel="noreferrer">
									<ExternalLink className="size-4" />
									Open
								</a>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive" onClick={onRemove}>
								Remove
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</div>
			<Button
				asChild
				variant="outline"
				size="sm"
				className="mt-3 w-full justify-between"
			>
				<a href={href} target="_blank" rel="noreferrer">
					<span>Open</span>
					<ExternalLink className="size-4" />
				</a>
			</Button>
		</div>
	);
}
