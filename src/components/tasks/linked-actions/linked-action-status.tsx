import {
	AlertCircle,
	CheckCircle2,
	Clock3,
	Loader2,
	type LucideIcon,
	MinusCircle,
} from "lucide-react";
import type { TaskLinkedAction } from "@/data/types-new";

const STATUS_META: Record<
	TaskLinkedAction["status"],
	{ label: string; className: string; Icon: LucideIcon }
> = {
	idle: {
		label: "Not run",
		className: "bg-muted text-muted-foreground",
		Icon: MinusCircle,
	},
	running: {
		label: "Running",
		className: "bg-secondary text-secondary-foreground",
		Icon: Loader2,
	},
	awaiting_manual_share: {
		label: "Awaiting share",
		className: "bg-accent text-accent-foreground",
		Icon: Clock3,
	},
	awaiting_manual_events_confirmation: {
		label: "Awaiting confirmation",
		className: "bg-accent text-accent-foreground",
		Icon: Clock3,
	},
	completed: {
		label: "Completed",
		className: "bg-primary/15 text-primary",
		Icon: CheckCircle2,
	},
	error: {
		label: "Error",
		className: "bg-destructive/15 text-destructive",
		Icon: AlertCircle,
	},
};

export function LinkedActionStatusBadge({
	status,
	actionType,
}: {
	status: TaskLinkedAction["status"];
	actionType: TaskLinkedAction["definition"]["type"];
}) {
	const meta = STATUS_META[status];
	const spinning = status === "running";
	const label =
		status === "completed" && actionType === "canva_template"
			? "Linked"
			: meta.label;
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
		>
			<meta.Icon className={`size-3.5 ${spinning ? "animate-spin" : ""}`} />
			{label}
		</span>
	);
}

export function LinkedActionStateNote({
	status,
	canRun,
	isReadOnlyMode,
}: {
	status: TaskLinkedAction["status"];
	canRun: boolean;
	isReadOnlyMode: boolean;
}) {
	if (status === "running") {
		return (
			<p className="text-xs text-muted-foreground">
				Action is running. This card will update when finished.
			</p>
		);
	}
	if (status === "idle") {
		if (!canRun && !isReadOnlyMode) {
			return (
				<p className="text-xs text-muted-foreground">
					You do not have permission to run this action.
				</p>
			);
		}
		if (isReadOnlyMode) {
			return (
				<p className="text-xs text-muted-foreground">
					Task is read-only in this view.
				</p>
			);
		}
		return <p className="text-xs text-muted-foreground">Not run yet.</p>;
	}
	if (status === "error") {
		return (
			<p className="text-xs text-destructive">
				Last run failed. Review the message below and retry.
			</p>
		);
	}
	if (status === "awaiting_manual_share") {
		return (
			<p className="text-xs text-muted-foreground">
				Next step required before this action can complete.
			</p>
		);
	}
	if (status === "awaiting_manual_events_confirmation") {
		return (
			<p className="text-xs text-muted-foreground">
				Please verify the events on WCA and confirm when done.
			</p>
		);
	}
	return null;
}
