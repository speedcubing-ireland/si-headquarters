import { createFileRoute } from "@tanstack/react-router";
import { GodModeAdminContent } from "@/components/admin/god-mode-admin-content";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { useIsDirector } from "@/hooks/use-convex-data";

export const Route = createFileRoute("/admin/email")({
	component: AdminEmailPage,
});

function AdminEmailPage() {
	const { isDirector, isLoading: isDirectorLoading } = useIsDirector();

	return (
		<PermissionGuard isLoading={isDirectorLoading} canAccess={isDirector}>
			<GodModeAdminContent defaultTab="discord" />
		</PermissionGuard>
	);
}
