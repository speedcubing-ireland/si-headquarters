import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ListTodo } from "lucide-react";
import { useIsDetailRoute } from "@/hooks/use-is-detail-route";
import { TasksPage } from "@/components/tasks/tasks-page";
import {
	tasksSearchSchema,
	stripSearchParams,
	defaultTasksSearch,
} from "@/lib/route-state";

export const Route = createFileRoute("/tasks")({
	validateSearch: tasksSearchSchema,
	search: {
		middlewares: [stripSearchParams(defaultTasksSearch)],
	},
	component: RouteComponent,
});

function RouteComponent() {
	const isDetailRoute = useIsDetailRoute("tasks");
	const search = Route.useSearch();

	if (isDetailRoute) {
		return <Outlet />;
	}

	return (
		<TasksPage
			pageId="all"
			pageTitle="All tasks"
			pageIcon={ListTodo}
			search={search}
		/>
	);
}
