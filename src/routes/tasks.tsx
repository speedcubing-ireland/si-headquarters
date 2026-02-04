import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ListTodo } from "lucide-react";
import { useIsDetailRoute } from "@/hooks/use-is-detail-route";
import { TasksPage } from "@/components/tasks/tasks-page";

export const Route = createFileRoute("/tasks")({
	component: RouteComponent,
});

function RouteComponent() {
	const isDetailRoute = useIsDetailRoute("tasks");

	if (isDetailRoute) {
		return <Outlet />;
	}

	return <TasksPage pageId="all" pageTitle="All tasks" pageIcon={ListTodo} />;
}
