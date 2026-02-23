import type { FormEventHandler, ReactNode } from "react";
import { Clock3, Loader2, ShieldCheck } from "lucide-react";
import type { SponsorBidStatus } from "@/lib/sponsorship-ui";
import { SponsorBidStatusBadge } from "@/components/sponsorship/sponsor-bid-status-badge";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AuctionBidActivityItem {
	id: string;
	sponsorLabel: string;
	amountLabel: string;
	isOwnBid: boolean;
	typeLabel: string;
	createdAtLabel: string;
}

interface AuctionBiddingSummaryCardProps {
	stateLabel: string;
	stateVariant: BadgeVariant;
	frameworkLabel: string;
	helpTitle: string;
	onHelpToggle?: () => void;
	helpContent?: ReactNode;
	closesAtText: string;
	priceLabel: string;
	priceValue: string;
	sponsorBidStatus?: SponsorBidStatus;
	myLastBidText: string;
	myMaxBidText?: string;
}

export function AuctionBiddingSummaryCard({
	stateLabel,
	stateVariant,
	frameworkLabel,
	helpTitle,
	onHelpToggle,
	helpContent,
	closesAtText,
	priceLabel,
	priceValue,
	sponsorBidStatus,
	myLastBidText,
	myMaxBidText,
}: AuctionBiddingSummaryCardProps) {
	return (
		<section className="space-y-3 rounded-lg border bg-card p-4">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant={stateVariant}>{stateLabel}</Badge>
				<Badge variant="outline">{frameworkLabel}</Badge>
				{onHelpToggle ? (
					<Button
						type="button"
						variant="link"
						className="h-auto p-0"
						onClick={onHelpToggle}
					>
						{helpTitle}
					</Button>
				) : (
					<span className="text-sm text-muted-foreground">{helpTitle}</span>
				)}
			</div>
			{helpContent}
			<div className="space-y-2 text-sm">
				<p className="text-muted-foreground">
					<span className="font-medium text-foreground">Closes: </span>
					{closesAtText}
				</p>
				<div className="space-y-1">
					<p className="font-medium">{priceLabel}</p>
					<div className="flex flex-wrap items-center gap-2">
						<p className="text-2xl font-semibold tabular-nums">{priceValue}</p>
						<SponsorBidStatusBadge status={sponsorBidStatus} showDot />
					</div>
				</div>
				<p className="text-muted-foreground">
					<span className="font-medium text-foreground">My last bid:</span>{" "}
					{myLastBidText}
				</p>
				{myMaxBidText ? (
					<p className="text-muted-foreground">
						<span className="font-medium text-foreground">My max bid:</span>{" "}
						{myMaxBidText}
					</p>
				) : null}
			</div>
		</section>
	);
}

interface AuctionAmountEntryCardProps {
	title: string;
	description: string;
	minimumLabel: string;
	minimumValue: string;
	minimumHint?: string;
	inputId: string;
	inputLabel: string;
	inputValue: string;
	inputMin: string;
	inputStep?: string;
	inputPlaceholder?: string;
	onInputChange: (value: string) => void;
	onSubmit: FormEventHandler<HTMLFormElement>;
	submitLabel: string;
	isSubmitting?: boolean;
}

export function AuctionAmountEntryCard({
	title,
	description,
	minimumLabel,
	minimumValue,
	minimumHint,
	inputId,
	inputLabel,
	inputValue,
	inputMin,
	inputStep = "0.01",
	inputPlaceholder,
	onInputChange,
	onSubmit,
	submitLabel,
	isSubmitting = false,
}: AuctionAmountEntryCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="mb-3 border-l-2 border-primary/40 pl-3">
					<p className="text-xs uppercase tracking-wide text-muted-foreground">
						{minimumLabel}
					</p>
					<p className="text-xl font-semibold tabular-nums leading-none">
						{minimumValue}
					</p>
					{minimumHint ? (
						<p className="mt-1 text-xs text-muted-foreground">{minimumHint}</p>
					) : null}
				</div>
				<form
					className="grid gap-3 sm:grid-cols-[1fr_auto]"
					onSubmit={onSubmit}
				>
					<div className="space-y-2">
						<Label htmlFor={inputId}>{inputLabel}</Label>
						<Input
							id={inputId}
							type="number"
							min={inputMin}
							step={inputStep}
							value={inputValue}
							onChange={(event) => onInputChange(event.target.value)}
							placeholder={inputPlaceholder}
							disabled={isSubmitting}
						/>
					</div>
					<div className="flex items-end">
						<Button type="submit" className="w-full" disabled={isSubmitting}>
							{isSubmitting ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								submitLabel
							)}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

interface AuctionBidActivityCardProps {
	description: ReactNode;
	isProxyAuction: boolean;
	bidHistoryVisible: boolean;
	items: AuctionBidActivityItem[];
	sealedMessage: string;
	unavailableMessage: string;
	emptyMessage: string;
}

export function AuctionBidActivityCard({
	description,
	isProxyAuction,
	bidHistoryVisible,
	items,
	sealedMessage,
	unavailableMessage,
	emptyMessage,
}: AuctionBidActivityCardProps) {
	const announcement = !isProxyAuction
		? sealedMessage
		: !bidHistoryVisible
			? unavailableMessage
			: null;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<ShieldCheck className="size-4" />
					Bid Activity
				</CardTitle>
				<CardDescription>
					{isProxyAuction ? (
						<>
							<Clock3 className="mr-1 inline size-3.5" />
							{description}
						</>
					) : (
						description
					)}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				{announcement ? (
					<div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
						{announcement}
					</div>
				) : items.length === 0 ? (
					<div className="text-sm text-muted-foreground">{emptyMessage}</div>
				) : (
					items.map((item) => (
						<div
							key={item.id}
							className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm"
						>
							<div className="flex items-center gap-2">
								<Badge variant={item.isOwnBid ? "default" : "secondary"}>
									{item.sponsorLabel}
								</Badge>
								<span className="font-medium tabular-nums">
									{item.amountLabel}
								</span>
								<Badge variant="outline">{item.typeLabel}</Badge>
							</div>
							<span className="text-xs text-muted-foreground">
								{item.createdAtLabel}
							</span>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}
