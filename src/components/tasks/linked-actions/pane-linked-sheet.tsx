import { Loader2 } from "lucide-react";
import type { LinkedSheetActionConfig } from "@/data/types-new";
import { Button } from "@/components/ui/button";

interface LinkedSheetPaneProps {
	config: LinkedSheetActionConfig;
	isRunning: boolean;
	isAwaitingShare: boolean;
	isSharingWithLaptops: boolean;
	isReadOnly: boolean;
	onRun: () => void;
	onShareWithLaptops: () => void;
}

export function LinkedSheetPane({
	config,
	isRunning,
	isAwaitingShare,
	isSharingWithLaptops,
	isReadOnly,
	onRun,
	onShareWithLaptops,
}: LinkedSheetPaneProps) {
	return (
		<div className="space-y-3">
			{!isAwaitingShare ? (
				<div>
					<Button size="sm" onClick={onRun} disabled={isRunning || isReadOnly}>
						{isRunning ? <Loader2 className="size-4 animate-spin" /> : null}
						Run
					</Button>
				</div>
			) : null}
			{config.operation === "populate_checkin_sheet" ? (
				<p className="text-xs text-muted-foreground">
					Populates the linked sheet WCA Data tab with accepted registrations.
				</p>
			) : null}
			{config.operation === "populate_checkin_sheet" && isAwaitingShare ? (
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
		</div>
	);
}
