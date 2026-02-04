import type { LucideIcon } from "lucide-react";
import { CheckIcon } from "lucide-react";
import React from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type SharedFilterOption = {
	value: string;
	label: string;
	icon?: LucideIcon | null;
	avatarUrl?: string;
	color?: string;
};

type OptionLike = {
	value: unknown;
	label: string;
	icon?: LucideIcon | null;
	avatarUrl?: string;
	color?: string;
};

export function mapToSharedFilterOptions(
	options: OptionLike[],
): SharedFilterOption[] {
	return options.map((o) => ({
		value: String(o.value),
		label: o.label,
		icon: o.icon,
		avatarUrl: o.avatarUrl,
		color: o.color,
	}));
}

type SharedFilterOptionRowProps = {
	option: SharedFilterOption;
	isSelected: boolean;
	onSelect: () => void;
};

export const SharedFilterOptionRow = React.memo(function SharedFilterOptionRow({
	option,
	isSelected,
	onSelect,
}: SharedFilterOptionRowProps) {
	const OptIcon = option.icon;

	return (
		<CommandItem
			value={String(option.value)}
			onSelect={onSelect}
			className="flex items-center justify-between"
		>
			<div className="flex items-center gap-2">
				{option.avatarUrl ? (
					<UserAvatar
						name={option.label}
						avatarUrl={option.avatarUrl}
						size="sm"
						alt={option.label}
					/>
				) : OptIcon ? (
					<OptIcon className="size-4 text-muted-foreground" />
				) : option.color ? (
					<div
						className="size-3 rounded-full"
						style={{ backgroundColor: option.color }}
					/>
				) : null}
				<span className="text-xs">{option.label}</span>
			</div>
			<CheckIcon
				className={cn(
					"size-4 text-muted-foreground",
					!isSelected ? "opacity-0" : null,
				)}
			/>
		</CommandItem>
	);
});
