export type Status =
	| "concept"
	| "pre-announcement"
	| "post-announcement"
	| "pre-competition"
	| "post-competition"
	| "archive";

export type Priority = "low" | "medium" | "high" | "urgent";

export type User = {
	name: string;
	avatarUrl: string;
};

export type Team = {
	name: string;
};

type Label = {
	name: string;
	color: string;
};

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
};

type ProjectType = "competition" | "standard";

export type Project = {
	id: string;
	type: ProjectType;
	name: string;
	leads: User[];
	owner: Team | User;
	status: Status;
	priority: Priority;
	startDate?: string;
	tasks: Task[];
};
