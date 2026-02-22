import { createFileRoute } from "@tanstack/react-router";
import { RefundsDashboard } from "@/components/admin/refunds-dashboard";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { useIsDelegate, useIsDirector } from "@/hooks/use-convex-data";

export const Route = createFileRoute("/admin/refunds")({
	component: RefundsRoute,
});

function RefundsRoute() {
	const { isDirector, isLoading: loadingDirector } = useIsDirector();
	const { isDelegate, isLoading: loadingDelegate } = useIsDelegate();
	const isLoading = loadingDirector || loadingDelegate;
	const canAccess = isDirector || isDelegate;

	return (
		<PermissionGuard isLoading={isLoading} canAccess={canAccess}>
			<RefundsDashboard />
		</PermissionGuard>
	);
}
