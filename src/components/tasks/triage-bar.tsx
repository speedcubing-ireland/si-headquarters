import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export type TriageFilter = "all" | "unassigned" | "assigned";

interface TriageBarProps {
	filter: TriageFilter;
	onFilterChange: (filter: TriageFilter) => void;
	taskCount: number;
}

export function TriageBar({
	filter,
	onFilterChange,
	taskCount,
}: TriageBarProps) {
	return (
		<div className="flex items-center justify-between border-b px-4 lg:px-6 py-2">
			<div className="flex items-center gap-2">
				<span className="text-xs text-muted-foreground">Triage view</span>
				<Separator orientation="vertical" className="h-4" />
				<div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5 text-xs">
					<Button
						variant={filter === "all" ? "secondary" : "ghost"}
						size="xs"
						className="h-6 px-2 text-xs"
						onClick={() => onFilterChange("all")}
					>
						All
					</Button>
					<Button
						variant={filter === "unassigned" ? "secondary" : "ghost"}
						size="xs"
						className="h-6 px-2 text-xs"
						onClick={() => onFilterChange("unassigned")}
					>
						Unassigned
					</Button>
					<Button
						variant={filter === "assigned" ? "secondary" : "ghost"}
						size="xs"
						className="h-6 px-2 text-xs"
						onClick={() => onFilterChange("assigned")}
					>
						Assigned
					</Button>
				</div>
			</div>
			<span className="text-xs text-muted-foreground">
				{taskCount} task{taskCount === 1 ? "" : "s"}
			</span>
		</div>
	);
}
