import { Calendar, CheckIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	ButtonGroup,
	ButtonGroupSeparator,
} from "@/components/ui/button-group";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DateRangeDisplay } from "@/lib/format-utils";
import { formatDateRangeForDisplay } from "@/lib/format-utils";
import { SharedFilterChip } from "./filter-chip";

type SharedDateRangeFilterChipProps = {
	dateRange: DateRangeDisplay & { isNot?: boolean };
	onClear: () => void;

	onIsNotChange?: (isNot: boolean) => void;

	onIsNotToggle?: () => void;
};

export function SharedDateRangeFilterChip({
	dateRange,
	onClear,
	onIsNotChange,
	onIsNotToggle,
}: SharedDateRangeFilterChipProps) {
	const dateText = formatDateRangeForDisplay(dateRange);

	if (onIsNotChange !== undefined) {
		return (
			<ButtonGroup>
				<Button variant="outline" size="xs">
					<Calendar />
					Date
				</Button>
				<ButtonGroupSeparator orientation="vertical" />
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="xs">
							{dateRange.isNot ? "is not" : "is"}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						<DropdownMenuItem
							onSelect={() => onIsNotChange(false)}
							className="cursor-pointer"
						>
							is
							{!dateRange.isNot && <CheckIcon className="ml-auto size-4" />}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() => onIsNotChange(true)}
							className="cursor-pointer"
						>
							is not
							{dateRange.isNot && <CheckIcon className="ml-auto size-4" />}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<ButtonGroupSeparator orientation="vertical" />
				<Button variant="outline" size="xs">
					{dateText}
				</Button>
				<ButtonGroupSeparator orientation="vertical" />
				<Button variant="outline" size="icon-xs" onClick={onClear}>
					<X />
				</Button>
			</ButtonGroup>
		);
	}

	return (
		<SharedFilterChip
			icon={() => <span className="text-xs">📅</span>}
			label="Date"
			values={[dateText]}
			isNot={dateRange.isNot ?? false}
			onToggleIsNot={onIsNotToggle ?? (() => {})}
			onToggleValue={() => {}}
			onRemove={onClear}
			renderValue={() => dateText}
		/>
	);
}
