type User = {
  id: string;
  name: string;
  avatarUrl: string;
}

type GoogleSheetResource = {
  type: "google-sheet";
  sheetId: string;
}

type CanvaResource = {
  type: "canva-design";
}

type LinkedResource = GoogleSheetResource | CanvaResource;

type ProgressUpdate = {
  id: string;
  timestamp: string;
  postedBy: User;
  status: "on-track" | "at-risk" | "off-track";
}

type CompetitionPhase = {
  id: string;
  name: string;
  description: string;
}

type CompetitionPhaseTemplate = Omit<CompetitionPhase, "id">;

const DEFAULT_PHASES: CompetitionPhaseTemplate[] = [
  {
    name: "Concept",
    description: "Still being discussed, no dates/venue yet",
  },
  {
    name: "Pre-Announcement",
    description: "Details being finalised, dates/venue confirmed",
  },
  {
    name: "Post-Announcement",
    description: "Announcement made, details confirmed, registration not closed",
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

type Team = {
  id: string;
  name: string;
  members: User[];
}

const TASK_STATUS = ["backlog", "to-do", "in-progress", "done", "cancelled"] as const;
const TASK_PRIORITY = ["low", "medium", "high", "urgent"] as const;

type TaskLabel = {
  id: string;
  label: string;
}

type TaskParent = {
  type: "task" | "phase" | "competition"
  linkedId: string;
} | null;

type Task = {
  id: string;
  parent: TaskParent;
  name: string;
  description: string;
  owner: Team | User | null;
  assignee: User | null;
  phase: CompetitionPhase | null;
  status: (typeof TASK_STATUS)[number];
  priority: (typeof TASK_PRIORITY)[number];
  requiredApprovalBy: (Team | User)[];
  approvedBy: (Team | User)[];
  labels: TaskLabel[];
  resources: LinkedResource[];
  comments: string[];
  subTasks: Task[];
}

export type Competition = {
  id: string;
  name: string;
  compStart: string;
  compEnd: string;
  compLead: User;
  leadDelegate: User;
  organisers: User[];
  phases: CompetitionPhase[];
  currentPhaseIdx: CompetitionPhase;
  progressUpdates: ProgressUpdate[];
  compSheet: GoogleSheetResource | null;
  tasks: Task[];
}