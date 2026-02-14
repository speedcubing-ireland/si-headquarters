import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { GodModeAdminContent } from "@/components/admin/god-mode-admin-content";
import { useIsDirector } from "@/hooks/use-convex-data";

export const Route = createFileRoute("/admin/email")({
	component: AdminEmailPage,
});

function AdminEmailPage() {
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

	return <GodModeAdminContent defaultTab="email" />;
}
