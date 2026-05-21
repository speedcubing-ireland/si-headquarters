import { SEEDED_TEAM_NAMES as TEAM_NAME_SEED_SOURCE } from "./constants";

export const DEFAULT_LABELS = [
	{ name: "Venue", color: "#2563eb" },
	{ name: "Budget", color: "#16a34a" },
	{ name: "Promotion", color: "#d946ef" },
	{ name: "Design", color: "#f43f5e" },
	{ name: "Registration", color: "#0ea5e9" },
	{ name: "Sponsors", color: "#eab308" },
	{ name: "Schedule", color: "#a3e635" },
	{ name: "Printing", color: "#8b5cf6" },
	{ name: "Certificate", color: "#22d3ee" },
] as const satisfies ReadonlyArray<{ name: string; color: string }>;

export type SeededLabelName = (typeof DEFAULT_LABELS)[number]["name"];

export const DEFAULT_PHASES: Array<{ name: string; description: string }> = [
	{ name: "Concept", description: "Still being discussed, no dates/venue yet" },
	{
		name: "Pre-Announcement",
		description: "Details being finalised, dates/venue confirmed",
	},
	{
		name: "Post-Announcement",
		description:
			"Announcement made, details confirmed, registration not closed",
	},
	{
		name: "Pre-Competition",
		description: "Registration closed, preparation in progress",
	},
	{
		name: "Post-Competition",
		description: "Competition completed, pending finalisation",
	},
	{
		name: "Archive",
		description: "All tasks completed, no further action required",
	},
];

export const COMPETITION_PHASE_KEYS = [
	"concept",
	"pre-announcement",
	"post-announcement",
	"pre-competition",
	"post-competition",
	"archive",
] as const;

export const SEEDED_TEAM_NAMES = TEAM_NAME_SEED_SOURCE;

export type SeededTeamName = (typeof SEEDED_TEAM_NAMES)[number];
