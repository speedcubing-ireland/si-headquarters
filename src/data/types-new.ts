export type User = {
	id: string;
	name: string;
	avatarUrl: string;
};

export type Team = {
	id: string;
	name: string;
	members: User[];
};

export type GoogleSheetResource = {
	type: "google-sheet";
	sheetId: string;
};

export type CanvaResource = {
	type: "canva-design";
	designId: string;
};

export type LinkedResource = GoogleSheetResource | CanvaResource;

export type ProgressUpdate = {
	id: string;
	timestamp: string;
	postedBy: User;
	status: "on-track" | "at-risk" | "off-track";
	message?: string;
};

export type CompetitionPhase = {
	id: string;
	name: string;
	description: string;
};

export type CompetitionPhaseTemplate = Omit<CompetitionPhase, "id">;

export const DEFAULT_PHASES: CompetitionPhaseTemplate[] = [
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
] as const;

export const COMPETITION_PHASE_KEYS = [
	"concept",
	"pre-announcement",
	"post-announcement",
	"pre-competition",
	"post-competition",
	"archive",
] as const;

export type CompetitionPhaseKey = (typeof COMPETITION_PHASE_KEYS)[number];

export const TASK_STATUS = [
	"backlog",
	"to-do",
	"in-progress",
	"done",
	"cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];

export const TASK_PRIORITY = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITY)[number];

export type TaskLabel = {
	id: string;
	name: string;
	color: string;
};

export type TaskParent =
	| { type: "task"; linkedId: string }
	| { type: "phase"; linkedId: string }
	| { type: "competition"; linkedId: string }
	| null;

export type Task = {
	id: string;
	identifier: string;
	parent: TaskParent;
	title: string;
	description: string;
	owner: Team | User | null;
	assignee: User | null;
	phase: CompetitionPhase | null;
	status: TaskStatus;
	priority: TaskPriority;
	dueDate: string | null;
	requiredApprovalBy: (Team | User)[];
	approvedBy: (Team | User)[];
	labels: TaskLabel[];
	resources: LinkedResource[];
	subTasks: Task[];
	createdAt: string;
	updatedAt: string;
};

export type Competition = {
	id: string;
	name: string;
	description: string;
	// Core competition scheduling
	compStart: string;
	compEnd: string;
	// High-level ownership
	compLead: User | null;
	leadDelegate: User | null;
	organisers: User[];
	// Phase workflow & progress
	phases: CompetitionPhase[];
	currentPhaseIdx: number;
	progressUpdates: ProgressUpdate[];
	compSheet: GoogleSheetResource | null;
	tasks: Task[];
	createdAt: string;
	updatedAt: string;
};

export const DEFAULT_LABELS: TaskLabel[] = [
	{ id: "label-1", name: "Bug", color: "#ef4444" },
	{ id: "label-2", name: "Feature", color: "#3b82f6" },
	{ id: "label-3", name: "Improvement", color: "#8b5cf6" },
	{ id: "label-4", name: "Documentation", color: "#06b6d4" },
	{ id: "label-5", name: "Urgent", color: "#f97316" },
	{ id: "label-6", name: "Review Needed", color: "#eab308" },
	{ id: "label-7", name: "Blocked", color: "#dc2626" },
	{ id: "label-8", name: "Quick Win", color: "#22c55e" },
];
