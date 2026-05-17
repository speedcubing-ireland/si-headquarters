import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ListTodo } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { TasksPage } from "@/components/tasks/tasks-page";
import type { TaskPredicate } from "@/lib/task-filter-utils";
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result";

export const Route = createFileRoute("/tasks/my")({
	component: RouteComponent,
});

function RouteComponent() {
	const currentUserResult = useQuery(api.core.users.getCurrentUser);
	const currentUserState = useRetainedQueryResult(currentUserResult);

	if (currentUserState.isLoading) {
		return (
			<div className="flex h-full flex-1 items-center justify-center">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}
	const currentUser = currentUserState.data;
	if (currentUser === null) {
		return (
			<div className="flex h-full flex-1 items-center justify-center">
				<p className="text-muted-foreground">
					Unable to load your user profile.
				</p>
			</div>
		);
	}

	const currentUserId = currentUser._id;

	const pagePredicates: TaskPredicate[] = [
		(t) => t.assignee?.id === currentUserId,
		(t) => t.owner?.id === currentUserId,
		(t) =>
			t.status === "awaiting-review" &&
			t.requiredApprovalBy.some((entity) => {
				if ("members" in entity) {
					return entity.members.some((m) => m.id === currentUserId);
				}
				return entity.id === currentUserId;
			}),
	];

	return (
		<TasksPage
			pageId="my"
			pageTitle="My tasks"
			pageIcon={ListTodo}
			pagePredicates={pagePredicates}
			pagePredicateMode="any"
			defaultDisplaySettings={{}}
		/>
	);
}
