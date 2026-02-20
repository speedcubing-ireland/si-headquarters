import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { useIsDirector } from "@/hooks/use-convex-data";
import { PermissionGuard } from "@/components/shared/permission-guard";

const GodModeAdminContent = lazy(() =>
	import("@/components/admin/god-mode-admin-content").then((module) => ({
		default: module.GodModeAdminContent,
	})),
);

export const Route = createFileRoute("/admin/god-mode")({
	component: GodModePage,
});

function GodModePage() {
	const { isDirector, isLoading: isDirectorLoading } = useIsDirector();

	return (
		<PermissionGuard isLoading={isDirectorLoading} canAccess={isDirector}>
			<Suspense
				fallback={
					<div className="flex h-full items-center justify-center p-4 text-muted-foreground text-sm">
						Loading admin tools...
					</div>
				}
			>
				<GodModeAdminContent defaultTab="users" />
			</Suspense>
		</PermissionGuard>
	);
}
