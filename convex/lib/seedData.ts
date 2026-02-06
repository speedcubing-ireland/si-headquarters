export const DEFAULT_LABELS: Array<{ name: string; color: string }> = [
	{ name: "Bug", color: "#ef4444" },
	{ name: "Feature", color: "#3b82f6" },
	{ name: "Improvement", color: "#8b5cf6" },
	{ name: "Documentation", color: "#06b6d4" },
	{ name: "Urgent", color: "#f97316" },
	{ name: "Review Needed", color: "#eab308" },
	{ name: "Blocked", color: "#dc2626" },
	{ name: "Quick Win", color: "#22c55e" },
	{ name: "Venue", color: "#3b82f6" },
	{ name: "Budget", color: "#22c55e" },
	{ name: "Marketing", color: "#a855f7" },
	{ name: "Design", color: "#ec4899" },
	{ name: "WCA", color: "#f97316" },
	{ name: "Registration", color: "#06b6d4" },
	{ name: "Logistics", color: "#64748b" },
	{ name: "Sponsors", color: "#eab308" },
];

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

export const SEEDED_TEAM_NAMES = [
	"Directors",
	"Delegates",
	"Competitions Team",
	"Social Media Team",
	"Finance Team",
	"Merch Team",
	"Software Team",
	"Graphics Team",
	"Volunteer",
] as const;

export type SeededTeamName = (typeof SEEDED_TEAM_NAMES)[number];
