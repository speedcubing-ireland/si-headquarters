import { CheckIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	CommandItem,
} from "@/components/ui/command";
import { getInitials } from "@/lib/competitions-utils";
import type { FilterType, FilterOption } from "@/lib/filter-config";

interface FilterOptionRowProps<T> {
	type: FilterType;
	option: FilterOption<T>;
	isSelected: boolean;
	onSelect: () => void;
}

export function FilterOptionRow<T>({
	type,
	option,
	isSelected,
	onSelect,
}: FilterOptionRowProps<T>) {
	const Icon = option.icon;
	const showAvatar = type === "leads" && option.avatarUrl;

	return (
		<CommandItem
			value={String(option.value)}
			onSelect={onSelect}
			className="flex items-center justify-between"
		>
			<div className="flex items-center gap-2">
				{Icon && <Icon className="size-4 text-muted-foreground" />}
				{showAvatar && (
					<Avatar className="size-5">
						<AvatarImage src={option.avatarUrl} alt={option.label} />
						<AvatarFallback className="text-xs">
							{getInitials(option.label)}
						</AvatarFallback>
					</Avatar>
				)}
				{!Icon && !showAvatar && <span className="size-4" />}
				{option.label}
			</div>
			{isSelected && <CheckIcon size={16} />}
		</CommandItem>
	);
}

