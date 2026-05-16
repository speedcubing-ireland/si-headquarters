import { AlertTriangle, CheckIcon, Gavel } from "lucide-react";
import { useCallback, useMemo } from "react";
import {
	auctionDerivedSponsorLabel,
	formatWinningBid,
	sponsorStatusBadgeVariant,
	sponsorStatusLabel,
} from "@/components/competitions/competition-detail-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Id } from "@/convex/_generated/dataModel";
import type { Competition } from "@/data/types-new";
import {
	useCompetitionMutations,
	useIsSponsorshipManager,
	useSponsors,
} from "@/hooks/use-convex-data";
import { onMutationError } from "@/lib/utils";

export function CompetitionSponsorStatusControl({
	competition,
}: {
	competition: Competition;
}) {
	const { updateCompetition } = useCompetitionMutations();
	const {
		isManager: isSponsorshipManager,
		isLoading: isSponsorshipAccessLoading,
	} = useIsSponsorshipManager();
	const { sponsors } = useSponsors(isSponsorshipManager);

	const activeSponsors = useMemo(
		() => sponsors.filter((sponsor) => sponsor.active),
		[sponsors],
	);
	const sponsorOptions = useMemo(() => {
		const byId = new Map(
			activeSponsors.map((sponsor) => [sponsor.id, sponsor]),
		);
		if (competition.manualSponsorId && !byId.has(competition.manualSponsorId)) {
			const currentManualSponsor = sponsors.find(
				(sponsor) => sponsor.id === competition.manualSponsorId,
			);
			if (currentManualSponsor) {
				byId.set(currentManualSponsor.id, currentManualSponsor);
			}
		}
		return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
	}, [activeSponsors, competition.manualSponsorId, sponsors]);

	const sponsorOverrideValue = competition.manualSponsorId
		? `sponsor:${competition.manualSponsorId}`
		: competition.manualSponsorPropertyStatus === "none"
			? "none"
			: "auto";
	const derivedSponsorOverrideValue =
		competition.auctionDerivedSponsorPropertyStatus === "sponsor" &&
		competition.auctionDerivedSponsorId
			? `sponsor:${competition.auctionDerivedSponsorId}`
			: competition.auctionDerivedSponsorPropertyStatus === "none"
				? "none"
				: "auto";
	const hasManualSponsorOverride =
		competition.manualSponsorPropertyStatus !== undefined ||
		competition.manualSponsorId !== undefined;
	const sponsorStatusTooltip = hasManualSponsorOverride
		? "Manual sponsor override"
		: competition.sponsorPropertyStatus === "sponsor"
			? "Winning bid from auction"
			: null;
	const SponsorStatusIcon = hasManualSponsorOverride
		? AlertTriangle
		: competition.sponsorPropertyStatus === "sponsor"
			? Gavel
			: null;
	const sponsorStatusBadge = (
		<Badge
			variant={sponsorStatusBadgeVariant(competition.sponsorPropertyStatus)}
			className="max-w-full"
		>
			{SponsorStatusIcon ? (
				<SponsorStatusIcon className="mr-1 size-3.5" />
			) : null}
			<span className="truncate">{sponsorStatusLabel(competition)}</span>
		</Badge>
	);
	const sponsorStatusBadgeWithTooltip = sponsorStatusTooltip ? (
		<Tooltip>
			<TooltipTrigger asChild>{sponsorStatusBadge}</TooltipTrigger>
			<TooltipContent side="top" sideOffset={6}>
				{sponsorStatusTooltip}
			</TooltipContent>
		</Tooltip>
	) : (
		sponsorStatusBadge
	);

	const handleSponsorOverrideChange = useCallback(
		(nextValue: string) => {
			if (!isSponsorshipManager) return;
			const mismatch =
				nextValue !== "auto" && nextValue !== derivedSponsorOverrideValue;
			if (mismatch) {
				const shouldApplyOverride = window.confirm(
					`Auction status currently suggests "${auctionDerivedSponsorLabel(competition)}". Apply manual sponsor override anyway?`,
				);
				if (!shouldApplyOverride) return;
			}
			if (nextValue === "auto") {
				void updateCompetition(competition.id, {
					sponsorPropertyStatusOverride: null,
					sponsorOverrideSponsorId: null,
				}).catch(onMutationError);
				return;
			}
			if (nextValue === "none") {
				void updateCompetition(competition.id, {
					sponsorPropertyStatusOverride: "none",
					sponsorOverrideSponsorId: null,
				}).catch(onMutationError);
				return;
			}
			const sponsorId = nextValue.replace("sponsor:", "") as Id<"sponsors">;
			void updateCompetition(competition.id, {
				sponsorPropertyStatusOverride: "sponsor",
				sponsorOverrideSponsorId: sponsorId,
			}).catch(onMutationError);
		},
		[
			competition,
			derivedSponsorOverrideValue,
			isSponsorshipManager,
			updateCompetition,
		],
	);

	return (
		<div className="space-y-2">
			{isSponsorshipAccessLoading ? (
				<div className="text-sm text-muted-foreground">
					Checking sponsor permissions...
				</div>
			) : null}
			{isSponsorshipManager ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-auto justify-start p-0 hover:bg-transparent"
						>
							{sponsorStatusBadge}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-64 p-0" align="start">
						<Command>
							<CommandList>
								<CommandEmpty>No sponsor options available.</CommandEmpty>
								<CommandGroup>
									<CommandItem
										value="auto"
										onSelect={() => handleSponsorOverrideChange("auto")}
										className="flex items-center justify-between"
									>
										<span className="text-xs">Follow auction outcome</span>
										{sponsorOverrideValue === "auto" ? (
											<CheckIcon size={14} className="ml-auto" />
										) : null}
									</CommandItem>
									<CommandItem
										value="none"
										onSelect={() => handleSponsorOverrideChange("none")}
										className="flex items-center justify-between"
									>
										<span className="text-xs">No sponsor (override)</span>
										{sponsorOverrideValue === "none" ? (
											<CheckIcon size={14} className="ml-auto" />
										) : null}
									</CommandItem>
									{sponsorOptions.map((sponsor) => {
										const value = `sponsor:${sponsor.id}`;
										return (
											<CommandItem
												key={sponsor.id}
												value={value}
												onSelect={() => handleSponsorOverrideChange(value)}
												className="flex items-center justify-between"
											>
												<span className="text-xs">
													{sponsor.name} (override)
												</span>
												{sponsorOverrideValue === value ? (
													<CheckIcon size={14} className="ml-auto" />
												) : null}
											</CommandItem>
										);
									})}
								</CommandGroup>
							</CommandList>
						</Command>
					</DropdownMenuContent>
				</DropdownMenu>
			) : (
				sponsorStatusBadgeWithTooltip
			)}
			{competition.sponsorPropertyStatus === "sponsor" &&
			competition.sponsorWinningBidCents !== undefined ? (
				<div className="text-sm text-muted-foreground">
					Winning bid {formatWinningBid(competition.sponsorWinningBidCents)}
				</div>
			) : null}
		</div>
	);
}
