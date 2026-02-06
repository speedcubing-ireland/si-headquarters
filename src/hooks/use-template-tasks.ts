import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
	CompetitionPhase,
	TaskLabel,
	Team,
	TemplateTask,
	User,
} from "@/data/types-new";
import { parseCompetitionId } from "@/lib/convex-ids";

type TemplateCreateTaskInput = {
	tempId: string;
	parentTempId?: string;
	title: string;
	description?: string;
	status: "to-do" | "backlog";
	priority: TemplateTask["priority"];
	dueDate?: string;
	ownerId?: Id<"teams">;
	ownerType?: "team";
	assigneeId?: Id<"users">;
	phaseId?: Id<"phases">;
	labelIds: Id<"labels">[];
	requiredApprovalIds?: string[];
};

type CompetitionTaskTemplate = {
	defaultTasks: TemplateTask[];
};

type BuildTemplateCreateTaskInputsArgs = {
	template: CompetitionTaskTemplate;
	competitionPhases: CompetitionPhase[];
	teams: Team[];
	users: User[];
	labels: TaskLabel[];
};

export function buildTemplateCreateTaskInputs({
	template,
	competitionPhases,
	teams,
	users,
	labels,
}: BuildTemplateCreateTaskInputsArgs): TemplateCreateTaskInput[] {
	const phasesByName = new Map(
		competitionPhases.map((phase) => [phase.name, phase]),
	);
	const firstPhaseName = competitionPhases[0]?.name ?? null;
	const teamsByName = new Map(teams.map((team) => [team.name, team]));
	const usersById = new Map(users.map((user) => [String(user.id), user]));
	const labelsByName = new Map(
		labels.map((label) => [label.name.toLowerCase(), label]),
	);

	const getInitialStatus = (phaseName: string | null): "to-do" | "backlog" =>
		firstPhaseName != null && phaseName === firstPhaseName
			? "to-do"
			: "backlog";

	const resolveOwnerAssignee = (task: TemplateTask) => {
		const owner = task.ownerTeamName
			? (teamsByName.get(task.ownerTeamName) ?? null)
			: null;
		const assignee =
			task.suggestedAssigneeId != null
				? (usersById.get(task.suggestedAssigneeId) ?? null)
				: null;
		return { owner, assignee };
	};

	const resolveRequiredApprovalIds = (
		teamNames: TemplateTask["requiredApprovalByTeamNames"],
	) => {
		if (!teamNames?.length) return undefined;
		return teamNames
			.map((teamName) => {
				const team = teamsByName.get(teamName);
				return team ? `team:${team.id}` : null;
			})
			.filter((approvalId): approvalId is string => approvalId != null);
	};

	const resolveLabelIds = (templateLabels: TemplateTask["labels"]) =>
		templateLabels
			.map((name) => labelsByName.get(name.toLowerCase())?.id)
			.filter((id): id is Id<"labels"> => id != null);

	let tempIdCounter = 0;
	const tasksToCreate: TemplateCreateTaskInput[] = [];

	const appendTask = (task: TemplateTask, parentTempId?: string) => {
		const tempId = `tmp-${tempIdCounter++}`;
		const { owner, assignee } = resolveOwnerAssignee(task);
		const requiredApprovalIds = resolveRequiredApprovalIds(
			task.requiredApprovalByTeamNames,
		);
		const phaseId = task.phase ? phasesByName.get(task.phase)?.id : undefined;

		tasksToCreate.push({
			tempId,
			...(parentTempId && { parentTempId }),
			title: task.title,
			description: task.description,
			status: getInitialStatus(task.phase),
			priority: task.priority,
			...(owner && { ownerId: owner.id, ownerType: "team" }),
			...(assignee && { assigneeId: assignee.id }),
			...(phaseId && { phaseId }),
			labelIds: resolveLabelIds(task.labels),
			...(requiredApprovalIds && { requiredApprovalIds }),
		});

		for (const subTask of task.subTasks ?? []) {
			appendTask(subTask, tempId);
		}
	};

	for (const task of template.defaultTasks) {
		appendTask(task);
	}

	return tasksToCreate;
}

export function useTemplateTasks(
	teams: Team[],
	users: User[],
	labels: TaskLabel[],
) {
	const createManyFromTemplateMutation = useMutation(
		api.tasks.createManyFromTemplate,
	);

	const createTasksFromTemplate = useCallback(
		async (
			competitionId: string,
			template: CompetitionTaskTemplate,
			competitionPhases: CompetitionPhase[],
		) => {
			const tasksToCreate = buildTemplateCreateTaskInputs({
				template,
				competitionPhases,
				teams,
				users,
				labels,
			});

			if (tasksToCreate.length === 0) return;

			await createManyFromTemplateMutation({
				competitionId: parseCompetitionId(competitionId) as Id<"competitions">,
				tasks: tasksToCreate,
			});
		},
		[createManyFromTemplateMutation, labels, teams, users],
	);

	return {
		createTasksFromTemplate,
	};
}
