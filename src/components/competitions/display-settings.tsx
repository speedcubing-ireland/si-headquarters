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
import { columnOptions } from "@/lib/competitions-constants";
import { useDisplaySettingsStore } from "@/store/display-settings-store";

export function DisplaySettings() {
	const grouping = useDisplaySettingsStore((state) => state.grouping);
	const subGrouping = useDisplaySettingsStore((state) => state.subGrouping);
	const ordering = useDisplaySettingsStore((state) => state.ordering);
	const setGrouping = useDisplaySettingsStore((state) => state.setGrouping);
	const setSubGrouping = useDisplaySettingsStore(
		(state) => state.setSubGrouping,
	);
	const setOrdering = useDisplaySettingsStore((state) => state.setOrdering);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm">
					<SquareDashedKanban className="size-4" />
					Display
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-64" align="end">
				<DropdownMenuLabel>Display Settings</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					{/* Grouping */}
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

					{/* Sub-grouping */}
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

					{/* Ordering */}
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
									onClick={() =>
										setOrdering(
											ordering.field,
											ordering.direction === "asc" ? "desc" : "asc",
										)
									}
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
