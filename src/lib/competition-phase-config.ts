import type { Competition, CompetitionPhaseKey } from "@/data/types-new";

export interface PhaseConfig {
	label: string;
	className: string;
}

export const phaseConfig: Record<CompetitionPhaseKey, PhaseConfig> = {
	concept: {
		label: "Concept",
		className:
			"bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-700",
	},
	"pre-announcement": {
		label: "Pre-Announcement",
		className:
			"bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-700",
	},
	"post-announcement": {
		label: "Post-Announcement",
		className:
			"bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-700",
	},
	"pre-competition": {
		label: "Pre-Competition",
		className:
			"bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-300 border border-teal-300 dark:border-teal-700",
	},
	"post-competition": {
		label: "Post-Competition",
		className:
			"bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-300 border border-green-300 dark:border-green-700",
	},
	archive: {
		label: "Archive",
		className:
			"bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600",
	},
};

export function getPhaseClass(key: CompetitionPhaseKey): string {
	return phaseConfig[key].className;
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
