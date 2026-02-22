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

export function getPhaseKeyFromName(
	name: string | null | undefined,
): CompetitionPhaseKey {
	const normalized = name?.trim().toLowerCase() ?? "concept";
	if (normalized.startsWith("concept")) return "concept";
	if (normalized.startsWith("pre-announcement")) return "pre-announcement";
	if (normalized.startsWith("post-announcement")) return "post-announcement";
	if (normalized.startsWith("pre-competition")) return "pre-competition";
	if (normalized.startsWith("post-competition")) return "post-competition";
	if (normalized.startsWith("archive")) return "archive";
	return "concept";
}

export function getCurrentPhaseKey(
	competition: Competition,
): CompetitionPhaseKey {
	const phase = competition.phases[competition.currentPhaseIdx];
	return getPhaseKeyFromName(phase?.name);
}
