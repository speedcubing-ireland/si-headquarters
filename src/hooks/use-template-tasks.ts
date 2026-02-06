import { useCallback } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type {
	CompetitionPhase,
	Team,
	User,
	TemplateTask,
} from "@/data/types-new";
import { parseCompetitionId } from "@/lib/convex-ids";
import { useTaskMutations } from "./use-convex-data";

export function useTemplateTasks(teams: Team[], users: User[]) {
	const { addTask } = useTaskMutations();

	const resolveOwnerAssignee = useCallback(
		(t: TemplateTask) => {
			let owner: User | { id: string; name: string; members: User[] } | null =
				null;

			if (t.ownerType === "team" && t.ownerId) {
				owner = teams.find((team) => team.id === t.ownerId) ?? null;
			} else if (t.ownerType === "user" && t.ownerId) {
				owner = users.find((u) => u.id === t.ownerId) ?? null;
			}

			let assignee: User | null = null;
			if (t.suggestedAssigneeId) {
				assignee = users.find((u) => u.id === t.suggestedAssigneeId) ?? null;
			} else if (owner && "members" in owner && owner.members?.length) {
				assignee = owner.members[0] ?? null;
			} else if (owner && !("members" in owner)) {
				assignee = owner as User;
			}

			return { owner, assignee };
		},
		[teams, users],
	);

	const resolveRequiredApprovalIds = useCallback(
		(teamNames: string[] | undefined) => {
			if (!teamNames?.length) return undefined;
			return teamNames
				.map((name) => {
					const team = teams.find((t) => t.name === name);
					return team ? `team-${team.id}` : null;
				})
				.filter((id): id is string => id != null);
		},
		[teams],
	);

	const createTaskFromTemplate = useCallback(
		async (
			task: TemplateTask,
			competitionId: string,
			phasesByName: Map<string, CompetitionPhase>,
			firstPhaseName: string | null,
			parentId?: string,
		) => {
			const getPhase = (phaseName: string | null) =>
				phaseName != null ? (phasesByName.get(phaseName) ?? null) : null;

			const getInitialStatus = (
				phaseName: string | null,
			): "to-do" | "backlog" =>
				firstPhaseName != null && phaseName === firstPhaseName
					? "to-do"
					: "backlog";

			const { owner, assignee } = resolveOwnerAssignee(task);

			return await addTask({
				parent: parentId
					? { type: "task", linkedId: parentId as Id<"tasks"> }
					: {
							type: "competition",
							linkedId: competitionId as Id<"competitions">,
						},
				title: task.title,
				description: task.description,
				owner: owner as Team | User | null,
				assignee,
				phase: getPhase(task.phase),
				status: getInitialStatus(task.phase),
				priority: task.priority,
				dueDate: null,
				labels: [],
				...(parentId && {
					requiredApprovalIds: resolveRequiredApprovalIds(
						task.requiredApprovalByTeamNames,
					),
					parentCompetitionId: parseCompetitionId(
						competitionId,
					) as Id<"competitions">,
				}),
			});
		},
		[addTask, resolveOwnerAssignee, resolveRequiredApprovalIds],
	);

	const createTasksFromTemplate = useCallback(
		async (
			competitionId: string,
			template: { defaultTasks: TemplateTask[] },
			competitionPhases: CompetitionPhase[],
		) => {
			const phasesByName = new Map(competitionPhases.map((p) => [p.name, p]));
			const firstPhaseName = competitionPhases[0]?.name ?? null;

			for (const task of template.defaultTasks) {
				if (task.subTasks?.length) {
					const parentResult = await createTaskFromTemplate(
						task,
						competitionId,
						phasesByName,
						firstPhaseName,
					);

					for (const subtask of task.subTasks) {
						await createTaskFromTemplate(
							subtask,
							competitionId,
							phasesByName,
							firstPhaseName,
							parentResult.id,
						);
					}
				} else {
					await createTaskFromTemplate(
						task,
						competitionId,
						phasesByName,
						firstPhaseName,
					);
				}
			}
		},
		[createTaskFromTemplate],
	);

	return {
		createTaskFromTemplate,
		createTasksFromTemplate,
	};
}
