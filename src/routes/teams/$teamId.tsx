import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TasksPage } from "@/components/tasks/tasks-page";
import { TriageBar, type TriageFilter } from "@/components/tasks/triage-bar";
import { useTeams } from "@/hooks/use-convex-data";
import type { Task, Team } from "@/data/types-new";
import { createOwnerPredicate } from "@/lib/task-filter-utils";
import type { TaskPredicate } from "@/lib/task-filter-utils";

export const Route = createFileRoute("/teams/$teamId")({
	component: RouteComponent,
});

function useTeam(teamId: string): Team | undefined {
	const { teams } = useTeams();
	return teams.find((t) => t.id === teamId);
}

function TeamNotFound() {
	return (
		<div className="flex h-full flex-1 items-center justify-center p-4">
			<Card className="max-w-md w-full border-dashed">
				<CardHeader>
					<CardTitle className="text-sm font-medium">Team not found</CardTitle>
				</CardHeader>
				<CardContent className="text-sm text-muted-foreground">
					The team you&apos;re looking for doesn&apos;t exist. It may have been
					renamed or removed.
				</CardContent>
			</Card>
		</div>
	);
}

function RouteComponent() {
	const { teamId } = Route.useParams();
	const team = useTeam(teamId);
	const [triageFilter, setTriageFilter] = useState<TriageFilter>("all");

	const pagePredicates = useMemo<TaskPredicate[]>(() => {
		const predicates: TaskPredicate[] = [createOwnerPredicate([teamId])];

		if (triageFilter === "unassigned") {
			predicates.push((task: Task) => !task.assignee);
		} else if (triageFilter === "assigned") {
			predicates.push((task: Task) => !!task.assignee);
		}

		return predicates;
	}, [teamId, triageFilter]);

	if (!team) {
		return <TeamNotFound />;
	}

	return (
		<TasksPage
			pageId={`team-${teamId}`}
			pageTitle={team.name}
			pageIcon={Users}
			pagePredicates={pagePredicates}
			pagePredicateMode="all"
			defaultDisplaySettings={{
				grouping: "status",
				subGrouping: null,
				ordering: { field: null, direction: "asc" },
			}}
			showCreateButton={false}
			subHeader={
				<TriageBar filter={triageFilter} onFilterChange={setTriageFilter} />
			}
		/>
	);
}
