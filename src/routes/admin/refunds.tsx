import { createFileRoute } from "@tanstack/react-router";
import { RefundsDashboard } from "@/components/admin/refunds-dashboard";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { useIsDirector, useIsVolunteer } from "@/hooks/use-convex-data";

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
			<RefundsDashboard />
		</PermissionGuard>
	);
}
