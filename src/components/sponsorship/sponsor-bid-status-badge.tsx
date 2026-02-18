import {
	sponsorBidStatusLabel,
	type SponsorBidStatus,
} from "@/lib/sponsorship-ui";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

	const variant = isInfo ? "info" : isPositive ? "success" : "error";

	const dotClassName = isInfo
		? "size-2 rounded-full bg-info"
		: isPositive
			? "size-2 rounded-full bg-success"
			: "size-2 rounded-full bg-error";

	return (
		<Badge
			variant={variant}
			className={cn(size === "compact" && "text-[11px]")}
		>
			{showDot ? <span className={dotClassName} /> : null}
			{sponsorBidStatusLabel(status)}
		</Badge>
	);
}
