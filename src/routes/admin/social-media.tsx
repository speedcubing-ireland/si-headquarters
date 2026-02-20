import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { useCanAccessSocialMediaDashboard } from "@/hooks/use-convex-data";

const SocialMediaDashboard = lazy(() =>
	import("@/components/admin/social-media-dashboard").then((module) => ({
		default: module.SocialMediaDashboard,
	})),
);

export const Route = createFileRoute("/admin/social-media")({
	component: SocialMediaRoute,
});

function SocialMediaRoute() {
	const { canAccess, isLoading } = useCanAccessSocialMediaDashboard();

	return (
		<PermissionGuard isLoading={isLoading} canAccess={canAccess}>
			<Suspense
				fallback={
					<div className="flex h-full items-center justify-center p-4 text-muted-foreground text-sm">
						Loading social media dashboard...
					</div>
				}
			>
				<SocialMediaDashboard />
			</Suspense>
		</PermissionGuard>
	);
}
