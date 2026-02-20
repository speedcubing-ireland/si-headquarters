import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { useIsDirector } from "@/hooks/use-convex-data";

const GodModeAdminContent = lazy(() =>
	import("@/components/admin/god-mode-admin-content").then((module) => ({
		default: module.GodModeAdminContent,
	})),
);

export const Route = createFileRoute("/admin/email")({
	component: AdminEmailPage,
});

function AdminEmailPage() {
	const { isDirector, isLoading: isDirectorLoading } = useIsDirector();

	return (
		<PermissionGuard isLoading={isDirectorLoading} canAccess={isDirector}>
			<Suspense
				fallback={
					<div className="flex h-full items-center justify-center p-4 text-muted-foreground text-sm">
						Loading email admin...
					</div>
				}
			>
				<GodModeAdminContent defaultTab="email" />
			</Suspense>
		</PermissionGuard>
	);
}
