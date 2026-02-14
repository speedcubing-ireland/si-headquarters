import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ListTodo } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { TasksPage } from "@/components/tasks/tasks-page";
import type { TaskPredicate } from "@/lib/task-filter-utils";

export const Route = createFileRoute("/tasks/my")({
	component: RouteComponent,
});

function RouteComponent() {
	const currentUser = useQuery(api.users.getCurrentUser);

	if (!currentUser) {
		return (
			<div className="flex h-full flex-1 items-center justify-center">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	const currentUserId = currentUser._id;

	const pagePredicates: TaskPredicate[] = [
		(t) => t.assignee?.id === currentUserId,
		(t) => t.owner?.id === currentUserId,
		(t) =>
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
