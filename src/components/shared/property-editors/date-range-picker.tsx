"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
	startDate: string | null;
	endDate: string | null;
	onChange: (startDate: string | null, endDate: string | null) => void;
	trigger: React.ReactNode;
	className?: string;
	align?: "start" | "center" | "end";
}

export function DateRangePicker({
	startDate,
	endDate,
	onChange,
	trigger,
	className,
	align = "end",
}: DateRangePickerProps) {
	const [open, setOpen] = React.useState(false);
	const [tempStart, setTempStart] = React.useState<Date | undefined>(
		startDate ? new Date(startDate) : undefined,
	);
	const [tempEnd, setTempEnd] = React.useState<Date | undefined>(
		endDate ? new Date(endDate) : undefined,
	);

	const handleApply = () => {
		onChange(
			tempStart ? tempStart.toISOString().split("T")[0] : null,
			tempEnd ? tempEnd.toISOString().split("T")[0] : null,
		);
		setOpen(false);
	};

	const handleClear = () => {
		setTempStart(undefined);
		setTempEnd(undefined);
		onChange(null, null);
		setOpen(false);
	};

	// Reset temp dates when opening
	React.useEffect(() => {
		if (open) {
			setTempStart(startDate ? new Date(startDate) : undefined);
			setTempEnd(endDate ? new Date(endDate) : undefined);
		}
	}, [open, startDate, endDate]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent className={cn("w-auto p-0", className)} align={align}>
				<div className="p-3">
					<div className="flex items-center gap-2 mb-3">
						<CalendarIcon className="size-4 text-muted-foreground" />
						<span className="text-sm font-medium">
							{tempStart && tempEnd
								? `${format(tempStart, "MMM d")} - ${format(tempEnd, "MMM d")}`
								: tempStart
									? `${format(tempStart, "MMM d")} - Select end date`
									: "Select date range"}
						</span>
					</div>
					<Calendar
						mode="range"
						selected={{
							from: tempStart,
							to: tempEnd,
						}}
						onSelect={(range) => {
							setTempStart(range?.from);
							setTempEnd(range?.to);
						}}
						numberOfMonths={1}
					/>
					<div className="flex items-center justify-between mt-3 pt-3 border-t">
						<Button variant="ghost" size="sm" onClick={handleClear}>
							Clear
						</Button>
						<Button size="sm" onClick={handleApply}>
							Apply
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

// Single date picker variant
interface DatePickerProps {
	date: string | null;
	onChange: (date: string | null) => void;
	trigger: React.ReactNode;
	className?: string;
	align?: "start" | "center" | "end";
}

export function DatePicker({
	date,
	onChange,
	trigger,
	className,
	align = "end",
}: DatePickerProps) {
	const [open, setOpen] = React.useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent className={cn("w-auto p-0", className)} align={align}>
				<div className="p-3">
					<Calendar
						mode="single"
						selected={date ? new Date(date) : undefined}
						onSelect={(selectedDate) => {
							onChange(
								selectedDate ? selectedDate.toISOString().split("T")[0] : null,
							);
							setOpen(false);
						}}
					/>
					<div className="flex items-center justify-end mt-3 pt-3 border-t">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								onChange(null);
								setOpen(false);
							}}
						>
							Clear
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
