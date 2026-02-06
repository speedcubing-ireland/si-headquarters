"use client";

import { format, setHours, setMinutes } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Id } from "@/convex/_generated/dataModel";
import {
	getRemindAtForPreset,
	REMINDER_PRESETS,
	type ReminderPresetKey,
} from "@/lib/reminder-presets";

function computeRemindAt(
	preset: ReminderPresetKey,
	customDate: Date | undefined,
	customTime: string,
): string {
	if (preset === "custom" && customDate) {
		const [h, m] = customTime.split(":").map(Number);
		const selectedDateTime = setMinutes(setHours(customDate, h), m);
		return selectedDateTime.toISOString();
	}
	return getRemindAtForPreset(preset, undefined, customDate);
}

function isDateTimeInFuture(date: Date, time: string): boolean {
	const [h, m] = time.split(":").map(Number);
	const selectedDateTime = setMinutes(setHours(date, h), m);
	return selectedDateTime > new Date();
}

interface RemindMeDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	taskId: string;
	onSetReminder?: (remindAt: string, message?: string) => void;
	mode?: "set" | "reschedule";
	reminderId?: Id<"reminders">;
	onReschedule?: (reminderId: Id<"reminders">, remindAt: string) => void;
}

export function RemindMeDialog({
	open,
	onOpenChange,
	taskId: _taskId,
	onSetReminder,
	mode = "set",
	reminderId,
	onReschedule,
}: RemindMeDialogProps) {
	const [preset, setPreset] = useState<ReminderPresetKey>("tomorrow");
	const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
	const [customTime, setCustomTime] = useState("09:00");
	const [message, setMessage] = useState("");

	const handleSubmit = () => {
		const remindAt = computeRemindAt(preset, customDate, customTime);
		if (mode === "reschedule" && reminderId && onReschedule) {
			onReschedule(reminderId, remindAt);
		} else if (onSetReminder) {
			onSetReminder(remindAt, message.trim() || undefined);
		}
		setMessage("");
		setCustomDate(undefined);
		setPreset("tomorrow");
		onOpenChange(false);
	};

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setMessage("");
			setCustomDate(undefined);
			setPreset("tomorrow");
		}
		onOpenChange(next);
	};

	const title = mode === "reschedule" ? "Reschedule reminder" : "Remind me";
	const submitLabel = mode === "reschedule" ? "Reschedule" : "Set reminder";
	const isCustomDateInvalid =
		preset === "custom" &&
		(!customDate || !isDateTimeInFuture(customDate, customTime));
	const isDisabled =
		isCustomDateInvalid ||
		(mode === "reschedule" && !onReschedule) ||
		(mode === "set" && !onSetReminder);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 py-2">
					<div className="space-y-2">
						<Label className="text-xs text-muted-foreground">When</Label>
						<div className="flex flex-wrap gap-2">
							{REMINDER_PRESETS.filter((p) => p.key !== "custom").map((p) => (
								<Button
									key={p.key}
									type="button"
									variant={preset === p.key ? "secondary" : "outline"}
									size="sm"
									onClick={() => setPreset(p.key)}
								>
									{p.label}
								</Button>
							))}
							<Button
								type="button"
								variant={preset === "custom" ? "secondary" : "outline"}
								size="sm"
								onClick={() => setPreset("custom")}
							>
								Custom
							</Button>
						</div>
					</div>
					{preset === "custom" && (
						<div className="space-y-2">
							<Label className="text-xs text-muted-foreground">
								Date and time
							</Label>
							<Calendar
								mode="single"
								selected={customDate}
								onSelect={setCustomDate}
								disabled={(date) => {
									const today = new Date();
									today.setHours(0, 0, 0, 0);
									const dateStart = new Date(date);
									dateStart.setHours(0, 0, 0, 0);
									return dateStart < today;
								}}
								className="rounded-md border"
							/>
							<div className="flex items-center gap-2">
								<Input
									type="time"
									value={customTime}
									onChange={(e) => setCustomTime(e.target.value)}
									className="w-28"
								/>
								{customDate && (
									<span className="text-sm text-muted-foreground">
										{format(customDate, "PPP")}
									</span>
								)}
							</div>
						</div>
					)}
					{mode === "set" && (
						<div className="space-y-2">
							<Label
								htmlFor="remind-me-message"
								className="text-xs text-muted-foreground"
							>
								Message (optional)
							</Label>
							<Input
								id="remind-me-message"
								placeholder="Add a note..."
								value={message}
								onChange={(e) => setMessage(e.target.value)}
								className="h-9"
							/>
						</div>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={isDisabled}>
						{submitLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
