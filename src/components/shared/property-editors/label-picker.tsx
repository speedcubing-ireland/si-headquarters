"use client";

import * as React from "react";
import { Check, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { TaskLabel } from "@/data/types-new";
import { cn } from "@/lib/utils";

interface LabelPickerProps {
	values: TaskLabel[];
	onChange: (values: TaskLabel[]) => void;
	availableLabels: TaskLabel[];
	trigger?: React.ReactNode;
	emptyText?: string;
	className?: string;
	align?: "start" | "center" | "end";
}

export function LabelPicker({
	values,
	onChange,
	availableLabels,
	trigger,
	emptyText = "No labels found.",
	className,
	align = "end",
}: LabelPickerProps) {
	const [open, setOpen] = React.useState(false);

	const toggleLabel = (label: TaskLabel) => {
		const isSelected = values.some((l) => l.id === label.id);
		if (isSelected) {
			onChange(values.filter((l) => l.id !== label.id));
		} else {
			onChange([...values, label]);
		}
	};

	const removeLabel = (labelId: string) => {
		onChange(values.filter((l) => l.id !== labelId));
	};

	return (
		<div className="flex flex-col gap-2">
			{/* Display selected labels */}
			{values.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{values.map((label) => (
						<Badge
							key={label.id}
							style={{ backgroundColor: label.color, color: "#fff" }}
							className="h-5 px-1.5 text-[10px] font-normal gap-1 cursor-pointer hover:opacity-80"
							onClick={() => removeLabel(label.id)}
						>
							{label.name}
							<X className="size-3" />
						</Badge>
					))}
				</div>
			)}

			{/* Add button / trigger */}
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					{trigger || (
						<Button
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
						>
							<Plus className="size-3 mr-1" />
							Add label
						</Button>
					)}
				</PopoverTrigger>
				<PopoverContent
					className={cn("p-0 w-[220px]", className)}
					align={align}
				>
					<Command>
						<CommandInput placeholder="Search labels..." />
						<CommandList className="max-h-[300px]">
							<CommandEmpty>{emptyText}</CommandEmpty>
							<CommandGroup heading="Select labels">
								{availableLabels.map((label) => {
									const isSelected = values.some((l) => l.id === label.id);
									return (
										<CommandItem
											key={label.id}
											value={label.id}
											onSelect={() => toggleLabel(label)}
										>
											<div className="flex items-center gap-2 flex-1">
												<span
													className="size-3 rounded-full"
													style={{ backgroundColor: label.color }}
												/>
												<span className="text-sm">{label.name}</span>
											</div>
											{isSelected && (
												<div className="size-4 rounded-full bg-primary flex items-center justify-center">
													<Check
														className="size-3 text-primary-foreground"
														strokeWidth={3}
													/>
												</div>
											)}
										</CommandItem>
									);
								})}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
}

// Inline version for sidebar use
interface InlineLabelPickerProps {
	values: TaskLabel[];
	onChange: (values: TaskLabel[]) => void;
	availableLabels: TaskLabel[];
	className?: string;
}

export function InlineLabelPicker({
	values,
	onChange,
	availableLabels,
	className,
}: InlineLabelPickerProps) {
	const [open, setOpen] = React.useState(false);

	const toggleLabel = (label: TaskLabel) => {
		const isSelected = values.some((l) => l.id === label.id);
		if (isSelected) {
			onChange(values.filter((l) => l.id !== label.id));
		} else {
			onChange([...values, label]);
		}
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex flex-wrap gap-1 min-h-[24px] w-full text-left",
						values.length === 0 && "text-muted-foreground/60 italic text-xs",
						className,
					)}
				>
					{values.length === 0
						? "Set labels..."
						: values.map((label) => (
								<Badge
									key={label.id}
									style={{ backgroundColor: label.color, color: "#fff" }}
									className="h-5 px-1.5 text-[10px] font-normal"
								>
									{label.name}
								</Badge>
							))}
				</button>
			</PopoverTrigger>
			<PopoverContent className="p-0 w-[220px]" align="end">
				<Command>
					<CommandInput placeholder="Search labels..." />
					<CommandList className="max-h-[300px]">
						<CommandEmpty>No labels found.</CommandEmpty>
						<CommandGroup heading="Select labels">
							{availableLabels.map((label) => {
								const isSelected = values.some((l) => l.id === label.id);
								return (
									<CommandItem
										key={label.id}
										value={label.id}
										onSelect={() => toggleLabel(label)}
									>
										<div className="flex items-center gap-2 flex-1">
											<span
												className="size-3 rounded-full"
												style={{ backgroundColor: label.color }}
											/>
											<span className="text-sm">{label.name}</span>
										</div>
										{isSelected && (
											<div className="size-4 rounded-full bg-primary flex items-center justify-center">
												<Check
													className="size-3 text-primary-foreground"
													strokeWidth={3}
												/>
											</div>
										)}
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
