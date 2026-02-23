import { Circle } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { Competition, CompetitionPhaseKey } from "@/data/types-new";
import { getPhaseKeyFromName } from "@/lib/competition-phase-config";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type PhaseListStyles = {
	rowCurrentClass: string;
	rowDefaultClass: string;
	dotCurrentClass: string;
	dotDefaultClass: string;
	currentBadgeClass: string;
};

const PHASE_LIST_STYLES: Record<CompetitionPhaseKey, PhaseListStyles> = {
	concept: {
		rowCurrentClass: "border-border bg-secondary text-secondary-foreground",
		rowDefaultClass:
			"border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-secondary-foreground",
		dotCurrentClass: "text-secondary-foreground fill-secondary-foreground",
		dotDefaultClass:
			"text-muted-foreground/45 group-hover:text-secondary-foreground/70",
		currentBadgeClass: "border-border bg-background text-secondary-foreground",
	},
	"pre-announcement": {
		rowCurrentClass: "border-error/40 bg-error/10 text-error",
		rowDefaultClass:
			"border-transparent text-muted-foreground hover:border-error/30 hover:bg-error/10 hover:text-error",
		dotCurrentClass: "text-error fill-error",
		dotDefaultClass: "text-error/45 group-hover:text-error/70",
		currentBadgeClass: "border-error/40 bg-background text-error",
	},
	"post-announcement": {
		rowCurrentClass: "border-info/40 bg-info/10 text-info",
		rowDefaultClass:
			"border-transparent text-muted-foreground hover:border-info/30 hover:bg-info/10 hover:text-info",
		dotCurrentClass: "text-info fill-info",
		dotDefaultClass: "text-info/45 group-hover:text-info/70",
		currentBadgeClass: "border-info/40 bg-background text-info",
	},
	"pre-competition": {
		rowCurrentClass: "border-warning/40 bg-warning/10 text-warning",
		rowDefaultClass:
			"border-transparent text-muted-foreground hover:border-warning/30 hover:bg-warning/10 hover:text-warning",
		dotCurrentClass: "text-warning fill-warning",
		dotDefaultClass: "text-warning/45 group-hover:text-warning/70",
		currentBadgeClass: "border-warning/40 bg-background text-warning",
	},
	"post-competition": {
		rowCurrentClass: "border-success/40 bg-success/10 text-success",
		rowDefaultClass:
			"border-transparent text-muted-foreground hover:border-success/30 hover:bg-success/10 hover:text-success",
		dotCurrentClass: "text-success fill-success",
		dotDefaultClass: "text-success/45 group-hover:text-success/70",
		currentBadgeClass: "border-success/40 bg-background text-success",
	},
	archive: {
		rowCurrentClass: "border-border bg-secondary text-secondary-foreground",
		rowDefaultClass:
			"border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-secondary-foreground",
		dotCurrentClass: "text-secondary-foreground fill-secondary-foreground",
		dotDefaultClass:
			"text-muted-foreground/45 group-hover:text-secondary-foreground/70",
		currentBadgeClass: "border-border bg-background text-secondary-foreground",
	},
};

interface CompetitionPhaseStatusListProps {
	competition: Competition;
	onSelectPhase?: (phaseId: Id<"phases">) => void;
	disableSelection?: boolean;
}

export function CompetitionPhaseStatusList({
	competition,
	onSelectPhase,
	disableSelection = false,
}: CompetitionPhaseStatusListProps) {
	return (
		<div className="flex flex-col gap-0.5">
			{competition.phases.map((phase, index) => {
				const isCurrent = index === competition.currentPhaseIdx;
				const phaseKey = getPhaseKeyFromName(phase.name);
				const phaseStyles = PHASE_LIST_STYLES[phaseKey];

				return (
					<button
						key={phase.id}
						type="button"
						onClick={() => {
							if (disableSelection) return;
							onSelectPhase?.(phase.id);
						}}
						className={cn(
							"group flex min-w-0 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
							isCurrent
								? phaseStyles.rowCurrentClass
								: phaseStyles.rowDefaultClass,
							disableSelection && "cursor-default",
						)}
					>
						<div className="flex min-w-0 items-center gap-2">
							<Circle
								className={cn(
									"size-2 transition-colors",
									isCurrent
										? phaseStyles.dotCurrentClass
										: phaseStyles.dotDefaultClass,
								)}
							/>
							<span
								className={cn("min-w-0 truncate", isCurrent && "font-medium")}
							>
								{phase.name}
							</span>
						</div>
						{isCurrent && (
							<Badge
								variant="outline"
								className={cn(
									"h-5 text-[10px] font-normal",
									phaseStyles.currentBadgeClass,
								)}
							>
								Current
							</Badge>
						)}
					</button>
				);
			})}
		</div>
	);
}
