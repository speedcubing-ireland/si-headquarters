import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/competitions/$id")({
	component: RouteComponent,
});

function RouteComponent() {
	const { id } = Route.useParams();
	return <div>Hello Competition {id}!</div>;
}
