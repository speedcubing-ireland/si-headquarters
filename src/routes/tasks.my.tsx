import { createFileRoute } from "@tanstack/react-router";
import { ListTodo } from "lucide-react";
import { useDataV2 } from "@/data/data-store-v2";
import { TasksPage } from "@/components/tasks/tasks-page";
import type { TaskPredicate } from "@/lib/task-filter-utils";
import {
	tasksSearchSchema,
	stripSearchParams,
	myTasksDefaultSearch,
} from "@/lib/route-state";

export const Route = createFileRoute("/tasks/my")({
	validateSearch: tasksSearchSchema,
	search: {
		middlewares: [stripSearchParams(myTasksDefaultSearch(""))],
	},
	component: RouteComponent,
});

function RouteComponent() {
	const users = useDataV2((state) => state.users);
	const teams = useDataV2((state) => state.teams);
	const competitions = useDataV2((state) => state.competitions);
	const currentUser = users[0];
	const search = Route.useSearch();

	if (!currentUser) {
		// Handle case where user isn't loaded yet
		return (
			<div className="flex h-full flex-1 items-center justify-center">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	// Calculate user's teams and IDs
	const myTeams = teams.filter((t) => t.members.includes(currentUser));
	const myIds = [currentUser.id, ...myTeams.map((t) => t.id)];

	// Calculate competitions where user is comp lead
	const myCompetitions = competitions
		.filter((c) => c.compLead?.id === currentUser.id)
		.map((c) => c.id);

	// Page predicates - tasks relevant to current user (ANY match)
	const pagePredicates: TaskPredicate[] = [
		// Assigned to me
		(t) => t.assignee?.id === currentUser.id,
		// Owned by me/my team
		(t) => (t.owner?.id ? myIds.includes(t.owner.id) : false),
		// Awaiting my/my team's approval
		(t) => t.requiredApprovalBy.some((entity) => myIds.includes(entity.id)),
		// Within my competition (as competition lead)
		(t) =>
			t.parent?.type === "competition" &&
			myCompetitions.includes(t.parent.linkedId),
	];

	return (
		<TasksPage
			pageId="my"
			pageTitle="My tasks"
			pageIcon={ListTodo}
			pagePredicates={pagePredicates}
			pagePredicateMode="any"
			defaultDisplaySettings={{
				grouping: "status",
				subGrouping: null,
				ordering: { field: null, direction: "asc" },
			}}
			search={search}
		/>
	);
}
