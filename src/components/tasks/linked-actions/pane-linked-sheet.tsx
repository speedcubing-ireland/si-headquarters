import { Loader2 } from "lucide-react";
import type { LinkedSheetActionConfig } from "@/data/types-new";
import { Button } from "@/components/ui/button";

interface LinkedSheetPaneProps {
	config: LinkedSheetActionConfig;
	isRunning: boolean;
	isReadOnly: boolean;
	onRun: () => void;
}

export function LinkedSheetPane({
	config,
	isRunning,
	isReadOnly,
	onRun,
}: LinkedSheetPaneProps) {
	return (
		<div className="space-y-3">
			<div>
				<Button size="sm" onClick={onRun} disabled={isRunning || isReadOnly}>
					{isRunning ? <Loader2 className="size-4 animate-spin" /> : null}
					Run
				</Button>
			</div>
			{config.operation === "populate_checkin_sheet" ? (
				<p className="text-xs text-muted-foreground">
					This operation is currently a no-op placeholder.
				</p>
			) : null}
		</div>
	);
}
