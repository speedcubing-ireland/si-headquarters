import { createFileRoute } from "@tanstack/react-router";
import type { Id } from "@/convex/_generated/dataModel";
import { ListTodo } from "lucide-react";
import { useUsers, useTeams, useCompetitions } from "@/hooks/use-convex-data";
import { TasksPage } from "@/components/tasks/tasks-page";
import type { TaskPredicate } from "@/lib/task-filter-utils";

export const Route = createFileRoute("/tasks/my")({
	component: RouteComponent,
});

function RouteComponent() {
	const { users } = useUsers();
	const { teams } = useTeams();
	const { competitions } = useCompetitions();
	const currentUser = users[0];

	if (!currentUser) {
		return (
			<div className="flex h-full flex-1 items-center justify-center">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	const myTeams = teams.filter((t) => t.members.includes(currentUser));
	const myIds = [currentUser.id, ...myTeams.map((t) => t.id)];

	const myCompetitions = competitions
		.filter((c) => c.compLead?.id === currentUser.id)
		.map((c) => c.id);

	const pagePredicates: TaskPredicate[] = [
		(t) => t.assignee?.id === currentUser.id,
		(t) => (t.owner?.id ? myIds.includes(t.owner.id) : false),
		(t) =>
			t.requiredApprovalBy.some((entity) => {
				if ("members" in entity) {
					return entity.members.some((m) => m.id === currentUser.id);
				}
				return entity.id === currentUser.id;
			}),
		(t) =>
			t.parent?.type === "competition" &&
			myCompetitions.includes(t.parent.linkedId as Id<"competitions">),
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
		/>
	);
}
