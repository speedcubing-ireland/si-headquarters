import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/inbox/settings")({
	component: RouteComponent,
});

function RouteComponent() {
	return <Navigate to="/account" replace />;
}
