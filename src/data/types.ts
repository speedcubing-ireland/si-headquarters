type Status =
  "backlog" |
  "to-do" |
  "in-progress" |
  "blocked" |
  "awaiting-review" |
  "completed" | 
  "cancelled";

type Priority = "low" | "medium" | "high" | "urgent";

type Milestone = {
  id: string;
  name: string;
  description: string;
}

type User = {
  name: string;
}

type Team = {
  name: string;
}

type Label = {
  name: string;
  color: string;
}

type Task = {
  id: string;
  name: string;
  description: string;
  owner: Team | User;
  assignees: User[];
  status: Status;
  priority: Priority;
  dueDate: Date;
  needsApprovalBy: (User | Team)[];
  approvedBy: (User | Team)[];
  labels: Label[];
  resources: string[];
  comments: string[];
  subTasks: Task[];
  dependentTasks: Task[];
}

export type Project = {
  id: string;
  name: string;
  leads: User[];
  owner: Team | User;
  status: Status;
  priority: Priority;
  milestones: Milestone[];
  tasks: Task[];
}