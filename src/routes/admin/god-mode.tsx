import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useIsDirector } from "@/hooks/use-convex-data";
import { GodModeAdminContent } from "@/components/admin/god-mode-admin-content";

export const Route = createFileRoute("/admin/god-mode")({
	component: GodModePage,
});

function GodModePage() {
	const { isDirector, isLoading: isDirectorLoading } = useIsDirector();

	if (isDirectorLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!isDirector) {
		return <Navigate to="/" />;
	}

	return <GodModeAdminContent defaultTab="users" />;
}
