import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/competitions/$id")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/competitions/$id"!</div>;
}
