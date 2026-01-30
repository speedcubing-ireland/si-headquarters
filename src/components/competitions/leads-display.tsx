import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
} from "@/components/ui/avatar";
import type { User } from "@/data/types-new";
import { getInitials } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

type LeadsDisplayVariant = "summary" | "detailed" | "compact";

interface LeadsDisplayProps {
	leads: User[];
	variant?: LeadsDisplayVariant;
	bold?: boolean;
}

export function LeadsDisplay({
	leads,
	variant = "summary",
	bold = false,
}: LeadsDisplayProps) {
	if (leads.length === 0) {
		return (
			<span
				className={cn("text-muted-foreground text-xs", bold && "font-bold")}
			>
				No lead
			</span>
		);
	}

	const content =
		leads.length === 1
			? leads[0].name
			: `${leads[0].name}${leads.length > 1 ? ` +${leads.length - 1}` : ""}`;

	return (
		<span className="flex items-center gap-1">
			<AvatarGroup>
				{leads.slice(0, 3).map((lead) => (
					<Avatar key={lead.name} className="size-4">
						<AvatarImage src={lead.avatarUrl} alt={lead.name} />
						<AvatarFallback className="text-[10px]">
							{getInitials(lead.name)}
						</AvatarFallback>
					</Avatar>
				))}
				{leads.length > 3 && (
					<AvatarGroupCount>+{leads.length - 3}</AvatarGroupCount>
				)}
			</AvatarGroup>
			{variant === "summary" || variant === "compact" ? (
				<span className={cn("text-xs", bold && "font-bold")}>{content}</span>
			) : (
				<span className={cn("text-xs hidden xl:inline", bold && "font-bold")}>
					{content}
				</span>
			)}
		</span>
	);
}
