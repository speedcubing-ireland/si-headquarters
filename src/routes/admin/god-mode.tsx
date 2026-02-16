import { createFileRoute } from "@tanstack/react-router";
import { useIsDirector } from "@/hooks/use-convex-data";
import { GodModeAdminContent } from "@/components/admin/god-mode-admin-content";
import { PermissionGuard } from "@/components/shared/permission-guard";

export const Route = createFileRoute("/admin/god-mode")({
	component: GodModePage,
});

function GodModePage() {
	const { isDirector, isLoading: isDirectorLoading } = useIsDirector();

	return (
		<PermissionGuard isLoading={isDirectorLoading} canAccess={isDirector}>
			<GodModeAdminContent defaultTab="users" />
		</PermissionGuard>
	);
}
