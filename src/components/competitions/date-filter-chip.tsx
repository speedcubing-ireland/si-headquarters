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
import { formatDate } from "@/lib/competitions-utils";
import { useCompetitionsFilterStore } from "@/store/competitions-filter-store";
import type { DateRangeFilter } from "@/store/competitions-filter-types";

interface DateFilterChipProps {
	dateRange: DateRangeFilter;
	onClear: () => void;
}

export function DateFilterChip({ dateRange, onClear }: DateFilterChipProps) {
	const setFilter = useCompetitionsFilterStore((state) => state.setFilter);

	const dateText =
		dateRange.start && dateRange.end
			? `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`
			: dateRange.start
				? `from ${formatDate(dateRange.start)}`
				: `until ${formatDate(dateRange.end)}`;

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
						onSelect={() => {
							setFilter("date", {
								...dateRange,
								isNot: false,
							});
						}}
					>
						is
						{!dateRange.isNot && <CheckIcon className="ml-auto size-4" />}
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() => {
							setFilter("date", {
								...dateRange,
								isNot: true,
							});
						}}
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
