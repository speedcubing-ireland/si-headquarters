import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import type {
	LinkedSheetActionConfig,
	TaskLinkedAction,
} from "@/data/types-new";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface LinkedSheetPaneProps {
	config: LinkedSheetActionConfig;
	status: TaskLinkedAction["status"];
	isRunning: boolean;
	isSharingWithLaptops: boolean;
	isConfirmingEvents: boolean;
	isReadOnly: boolean;
	eventsEditUrl: string | null;
	onRun: (overwriteEvents: boolean) => void;
	onShareWithLaptops: () => void;
	onConfirmEvents: () => void;
}

export function LinkedSheetPane({
	config,
	status,
	isRunning,
	isSharingWithLaptops,
	isConfirmingEvents,
	isReadOnly,
	eventsEditUrl,
	onRun,
	onShareWithLaptops,
	onConfirmEvents,
}: LinkedSheetPaneProps) {
	const [overwriteEvents, setOverwriteEvents] = useState(false);
	const isAwaitingLaptopShare =
		config.operation === "populate_checkin_sheet" &&
		status === "awaiting_manual_share";
	const isAwaitingEventsConfirmation =
		config.operation === "transfer_schedule_to_wca" &&
		status === "awaiting_manual_events_confirmation";

	const handleRun = () => {
		onRun(overwriteEvents);
	};

	return (
		<div className="space-y-3">
			{!isAwaitingLaptopShare && !isAwaitingEventsConfirmation ? (
				<div className="space-y-3">
					{config.operation === "transfer_schedule_to_wca" ? (
						<div className="flex items-center gap-2">
							<Checkbox
								id="overwrite-events"
								checked={overwriteEvents}
								onCheckedChange={(checked) =>
									setOverwriteEvents(checked === true)
								}
								disabled={isReadOnly || isRunning}
							/>
							<Label
								htmlFor="overwrite-events"
								className="text-xs text-muted-foreground"
							>
								Overwrite existing event data (cutoffs, time limits,
								progressions)
							</Label>
						</div>
					) : null}
					<div>
						<Button
							size="sm"
							onClick={handleRun}
							disabled={isRunning || isReadOnly}
						>
							{isRunning ? <Loader2 className="size-4 animate-spin" /> : null}
							Run
						</Button>
					</div>
				</div>
			) : null}
			{config.operation === "populate_checkin_sheet" ? (
				<p className="text-xs text-muted-foreground">
					Populates the linked sheet WCA Data tab with accepted registrations.
				</p>
			) : null}
			{config.operation === "transfer_schedule_to_wca" ? (
				<p className="text-xs text-muted-foreground">
					Transfers the schedule from the sheet to WCA, including cutoffs and
					progressions.
				</p>
			) : null}
			{isAwaitingLaptopShare ? (
				<div className="rounded-lg border border-accent bg-accent/30 p-3">
					<p className="text-xs text-accent-foreground">
						Step 2 required: share the sheet with laptops to grant edit access
						for check-in.
					</p>
					<div className="mt-3">
						<Button
							size="sm"
							onClick={onShareWithLaptops}
							disabled={isReadOnly || isSharingWithLaptops}
						>
							{isSharingWithLaptops ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							Share Sheet With Laptops
						</Button>
					</div>
				</div>
			) : null}
			{isAwaitingEventsConfirmation ? (
				<div className="rounded-lg border border-accent bg-accent/30 p-3">
					<div className="mb-2 text-xs font-medium text-accent-foreground">
						Manual verification required
					</div>
					<p className="text-xs text-accent-foreground">
						Please verify that cutoffs and progressions are correct on WCA, then
						confirm below.
					</p>
					<div className="mt-3 flex flex-wrap gap-2">
						{eventsEditUrl ? (
							<Button asChild variant="outline" size="sm">
								<a href={eventsEditUrl} target="_blank" rel="noreferrer">
									<ExternalLink className="size-3.5" />
									Open WCA Events
								</a>
							</Button>
						) : null}
						<Button
							size="sm"
							onClick={onConfirmEvents}
							disabled={isReadOnly || isConfirmingEvents}
						>
							{isConfirmingEvents ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							Confirm Events
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}
