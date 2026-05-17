import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/inbox/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <Navigate to="/account" replace />;
}
