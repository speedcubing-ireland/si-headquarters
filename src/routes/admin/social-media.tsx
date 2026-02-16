import { createFileRoute } from "@tanstack/react-router";
import { SocialMediaDashboard } from "@/components/admin/social-media-dashboard";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { useCanAccessSocialMediaDashboard } from "@/hooks/use-convex-data";

export const Route = createFileRoute("/admin/social-media")({
	component: SocialMediaRoute,
});

function SocialMediaRoute() {
	const { canAccess, isLoading } = useCanAccessSocialMediaDashboard();

	return (
		<PermissionGuard isLoading={isLoading} canAccess={canAccess}>
			<SocialMediaDashboard />
		</PermissionGuard>
	);
}
