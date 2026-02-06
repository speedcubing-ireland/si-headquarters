import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	IndentIncrease,
	List,
	SquareDashedKanban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	ButtonGroup,
	ButtonGroupSeparator,
} from "@/components/ui/button-group";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type DisplaySettingsState = {
	grouping: string | null;
	subGrouping: string | null;
	ordering: { field: string | null; direction: "asc" | "desc" };
	setGrouping: (field: string | null) => void;
	setSubGrouping: (field: string | null) => void;
	setOrdering: (field: string | null, direction: "asc" | "desc") => void;
	toggleOrderDirection: () => void;
	toJSON: () => string;
	fromJSON: (json: string) => void;
	reset: () => void;
};

type ColumnOption = {
	value: string;
	label: string;
};

type UseDisplaySettingsStore = <T>(
	selector: (state: DisplaySettingsState) => T,
) => T;

interface SharedDisplaySettingsProps {
	columnOptions: ColumnOption[];
	useDisplaySettingsStore: UseDisplaySettingsStore;
}

export function SharedDisplaySettings({
	columnOptions,
	useDisplaySettingsStore,
}: SharedDisplaySettingsProps) {
	const grouping = useDisplaySettingsStore((state) => state.grouping);
	const subGrouping = useDisplaySettingsStore((state) => state.subGrouping);
	const ordering = useDisplaySettingsStore((state) => state.ordering);
	const setGrouping = useDisplaySettingsStore((state) => state.setGrouping);
	const setSubGrouping = useDisplaySettingsStore(
		(state) => state.setSubGrouping,
	);
	const setOrdering = useDisplaySettingsStore((state) => state.setOrdering);
	const toggleOrderDirection = useDisplaySettingsStore(
		(state) => state.toggleOrderDirection,
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm">
					<SquareDashedKanban className="size-4" />
					Display
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-[min(16rem,calc(100vw-1rem))] sm:w-64"
				align="end"
			>
				<DropdownMenuLabel>Display Settings</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<div className="flex items-center gap-2 px-2 py-1.5">
						<List className="size-4 text-muted-foreground" />
						<span className="text-sm font-medium flex-1">Grouping</span>
						<Select
							value={grouping || undefined}
							onValueChange={(value) =>
								setGrouping(value === "none" ? null : value)
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="None" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">None</SelectItem>
								{columnOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="flex items-center gap-2 px-2 py-1.5">
						<IndentIncrease className="size-4 text-muted-foreground" />
						<span className="text-sm font-medium flex-1">Sub-grouping</span>
						<Select
							value={subGrouping || undefined}
							onValueChange={(value) =>
								setSubGrouping(value === "none" ? null : value)
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="None" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">None</SelectItem>
								{columnOptions
									.filter((option) => option.value !== grouping)
									.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-center gap-2 px-2 py-1.5">
						<ArrowUpDown className="size-4 text-muted-foreground" />
						<span className="text-sm font-medium flex-1">Ordering</span>
						{ordering.field ? (
							<ButtonGroup>
								<Select
									value={ordering.field || undefined}
									onValueChange={(value) =>
										setOrdering(
											value === "none" ? null : value,
											ordering.direction,
										)
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="None" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">None</SelectItem>
										{columnOptions.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<ButtonGroupSeparator orientation="vertical" />
								<Button
									variant="outline"
									size="icon"
									onClick={() => toggleOrderDirection()}
								>
									{ordering.direction === "asc" ? (
										<ArrowUp className="size-4" />
									) : (
										<ArrowDown className="size-4" />
									)}
								</Button>
							</ButtonGroup>
						) : (
							<Select
								value={ordering.field || undefined}
								onValueChange={(value) =>
									setOrdering(
										value === "none" ? null : value,
										ordering.direction,
									)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="None" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">None</SelectItem>
									{columnOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
