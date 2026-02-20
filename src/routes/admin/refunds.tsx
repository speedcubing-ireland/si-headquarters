import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { useIsDirector, useIsVolunteer } from "@/hooks/use-convex-data";

const RefundsDashboard = lazy(() =>
	import("@/components/admin/refunds-dashboard").then((module) => ({
		default: module.RefundsDashboard,
	})),
);

export const Route = createFileRoute("/admin/refunds")({
	component: RefundsRoute,
});

function RefundsRoute() {
	const { isDirector, isLoading: loadingDirector } = useIsDirector();
	const { isVolunteer, isLoading: loadingVolunteer } = useIsVolunteer();
	const isLoading = loadingDirector || loadingVolunteer;
	const canAccess = isDirector || isVolunteer;

	return (
		<PermissionGuard isLoading={isLoading} canAccess={canAccess}>
			<Suspense
				fallback={
					<div className="flex h-full items-center justify-center p-4 text-muted-foreground text-sm">
						Loading refunds dashboard...
					</div>
				}
			>
				<RefundsDashboard />
			</Suspense>
		</PermissionGuard>
	);
}
