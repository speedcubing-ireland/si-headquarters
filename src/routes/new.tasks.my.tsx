import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/new/tasks/my")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/new/tasks/my"!</div>;
}
