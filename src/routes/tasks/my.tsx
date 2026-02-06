import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { ListTodo } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useTeams, useCompetitions } from "@/hooks/use-convex-data";
import { TasksPage } from "@/components/tasks/tasks-page";
import type { TaskPredicate } from "@/lib/task-filter-utils";

export const Route = createFileRoute("/tasks/my")({
	component: RouteComponent,
});

function RouteComponent() {
	const currentUser = useQuery(api.users.getCurrentUser);
	const { teams } = useTeams();
	const { competitions } = useCompetitions();

	if (!currentUser) {
		return (
			<div className="flex h-full flex-1 items-center justify-center">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	const currentUserId = currentUser._id;
	const myTeams = teams.filter((t) =>
		t.members.some((member) => member.id === currentUserId),
	);
	const myIds = [currentUserId, ...myTeams.map((t) => t.id)];

	const myCompetitions = competitions
		.filter((c) => c.compLead?.id === currentUserId)
		.map((c) => c.id);

	const pagePredicates: TaskPredicate[] = [
		(t) => t.assignee?.id === currentUserId,
		(t) => (t.owner?.id ? myIds.includes(t.owner.id) : false),
		(t) =>
			t.requiredApprovalBy.some((entity) => {
				if ("members" in entity) {
					return entity.members.some((m) => m.id === currentUserId);
				}
				return entity.id === currentUserId;
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
