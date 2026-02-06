import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
	CompetitionPhase,
	SeededLabelName,
	SeededTeamName,
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

export function useTemplateTasks(
	teams: Team[],
	users: User[],
	labels: TaskLabel[],
) {
	const createManyFromTemplateMutation = useMutation(
		api.tasks.createManyFromTemplate,
	);

	const resolveOwnerAssignee = useCallback(
		(task: TemplateTask) => {
			const owner = task.ownerTeamName
				? (teams.find((team) => team.name === task.ownerTeamName) ?? null)
				: null;

			let assignee: User | null = null;
			if (task.suggestedAssigneeId) {
				assignee = users.find((u) => u.id === task.suggestedAssigneeId) ?? null;
			} else if (owner?.members.length) {
				assignee = owner.members[0] ?? null;
			}

			return { owner, assignee };
		},
		[teams, users],
	);

	const resolveRequiredApprovalIds = useCallback(
		(teamNames: SeededTeamName[] | undefined) => {
			if (!teamNames?.length) return undefined;
			return teamNames
				.map((name) => {
					const team = teams.find((t) => t.name === name);
					return team ? `team:${team.id}` : null;
				})
				.filter((id): id is string => id != null);
		},
		[teams],
	);

	const resolveLabels = useCallback(
		(templateLabels: SeededLabelName[]) => {
			if (!templateLabels.length) return [];
			const labelsByName = new Map(
				labels.map((label) => [label.name.toLowerCase(), label]),
			);
			return templateLabels
				.map((name) => labelsByName.get(name.toLowerCase()) ?? null)
				.filter((label): label is TaskLabel => label != null);
		},
		[labels],
	);

	const createTasksFromTemplate = useCallback(
		async (
			competitionId: string,
			template: { defaultTasks: TemplateTask[] },
			competitionPhases: CompetitionPhase[],
		) => {
			const phasesByName = new Map(competitionPhases.map((p) => [p.name, p]));
			const firstPhaseName = competitionPhases[0]?.name ?? null;
			let tempIdCounter = 0;
			const tasksToCreate: TemplateCreateTaskInput[] = [];

			const getInitialStatus = (
				phaseName: string | null,
			): "to-do" | "backlog" =>
				firstPhaseName != null && phaseName === firstPhaseName
					? "to-do"
					: "backlog";

			const appendTask = (task: TemplateTask, parentTempId?: string) => {
				const tempId = `tmp-${tempIdCounter++}`;
				const { owner, assignee } = resolveOwnerAssignee(task);
				const requiredApprovalIds = resolveRequiredApprovalIds(
					task.requiredApprovalByTeamNames,
				);

				tasksToCreate.push({
					tempId,
					...(parentTempId && { parentTempId }),
					title: task.title,
					description: task.description,
					status: getInitialStatus(task.phase),
					priority: task.priority,
					...(owner && { ownerId: owner.id, ownerType: "team" }),
					...(assignee && { assigneeId: assignee.id }),
					...(task.phase && {
						phaseId: phasesByName.get(task.phase)?.id as
							| Id<"phases">
							| undefined,
					}),
					labelIds: resolveLabels(task.labels).map((label) => label.id),
					...(requiredApprovalIds && { requiredApprovalIds }),
				});

				for (const subTask of task.subTasks ?? []) {
					appendTask(subTask, tempId);
				}
			};

			for (const task of template.defaultTasks) {
				appendTask(task);
			}

			if (tasksToCreate.length === 0) return;

			await createManyFromTemplateMutation({
				competitionId: parseCompetitionId(competitionId) as Id<"competitions">,
				tasks: tasksToCreate,
			});
		},
		[
			createManyFromTemplateMutation,
			resolveLabels,
			resolveOwnerAssignee,
			resolveRequiredApprovalIds,
		],
	);

	return {
		createTasksFromTemplate,
	};
}
