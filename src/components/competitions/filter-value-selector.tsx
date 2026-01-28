import { FilterOptionRow } from "@/components/competitions/filter-option-row";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandList,
} from "@/components/ui/command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDataV2 } from "@/data/data-store-v2";
import {
	type FilterType,
	filterConfigs,
	getFilterOptions,
} from "@/lib/filter-config";

type FilterValueSelectorProps<T> = {
	type: FilterType;
	selectedValues: T[];
	onToggleValue: (value: T) => void;
	children: React.ReactNode;
};

export function FilterValueSelector<T extends string>({
	type,
	selectedValues,
	onToggleValue,
	children,
}: FilterValueSelectorProps<T>) {
	const config = filterConfigs[type];
	const users = useDataV2((state) => state.users);
	const options = getFilterOptions(type, users);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
			<DropdownMenuContent className="w-60" align="start">
				<Command>
					<CommandInput placeholder={config.placeholder} />
					<CommandList>
						<CommandEmpty>{config.emptyMessage}</CommandEmpty>
						<CommandGroup>
							{options.map((option) => {
								const optionValue = option.value as T;
								const isSelected = selectedValues.includes(optionValue);
								return (
									<FilterOptionRow
										key={String(optionValue)}
										type={type}
										option={option}
										isSelected={isSelected}
										onSelect={() => onToggleValue(optionValue)}
									/>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
