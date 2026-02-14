import {
	sponsorBidStatusLabel,
	type SponsorBidStatus,
} from "@/lib/sponsorship-ui";

type SponsorBidStatusBadgeSize = "compact" | "default";

export function SponsorBidStatusBadge(props: {
	status: SponsorBidStatus | undefined;
	size?: SponsorBidStatusBadgeSize;
	showDot?: boolean;
}) {
	const { status, size = "default", showDot = false } = props;
	if (!status) return null;

	const isPositive = status === "winning" || status === "winner";
	const isInfo = status === "bid_submitted";
	const baseClassName =
		size === "compact"
			? "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
			: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";
	const colorClassName = isInfo
		? "border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400"
		: isPositive
			? "border border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
			: "border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400";
	const dotClassName = isInfo
		? "size-2 rounded-full bg-blue-500"
		: isPositive
			? "size-2 rounded-full bg-green-500"
			: "size-2 rounded-full bg-red-500";

	return (
		<span className={`${baseClassName} ${colorClassName}`}>
			{showDot ? <span className={dotClassName} /> : null}
			{sponsorBidStatusLabel(status)}
		</span>
	);
}
