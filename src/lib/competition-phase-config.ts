import type { Competition, CompetitionPhaseKey } from "@/data/types-new";
import type { BadgeVariant } from "@/components/ui/badge";

const phaseConfig: Record<
	CompetitionPhaseKey,
	{ label: string; variant: BadgeVariant }
> = {
	concept: {
		label: "Concept",
		variant: "secondary",
	},
	"pre-announcement": {
		label: "Pre-Announcement",
		variant: "error-outline",
	},
	"post-announcement": {
		label: "Post-Announcement",
		variant: "info-outline",
	},
	"pre-competition": {
		label: "Pre-Competition",
		variant: "warning-outline",
	},
	"post-competition": {
		label: "Post-Competition",
		variant: "success-outline",
	},
	archive: {
		label: "Archive",
		variant: "secondary",
	},
};

export function getPhaseVariant(key: CompetitionPhaseKey): BadgeVariant {
	return phaseConfig[key].variant;
}

export function getPhaseLabel(key: CompetitionPhaseKey): string {
	return phaseConfig[key].label;
}

export function getCurrentPhaseKey(
	competition: Competition,
): CompetitionPhaseKey {
	const phase = competition.phases[competition.currentPhaseIdx];
	const name = phase?.name.toLowerCase() ?? "concept";
	if (name.startsWith("concept")) return "concept";
	if (name.startsWith("pre-announcement")) return "pre-announcement";
	if (name.startsWith("post-announcement")) return "post-announcement";
	if (name.startsWith("pre-competition")) return "pre-competition";
	if (name.startsWith("post-competition")) return "post-competition";
	if (name.startsWith("archive")) return "archive";
	return "concept";
}
