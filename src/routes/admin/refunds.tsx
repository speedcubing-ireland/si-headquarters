import { createFileRoute } from "@tanstack/react-router"
import { AbilityRouteGuard } from "@/features/auth"
import { RefundsDashboard } from "@/features/admin/refunds"

export const Route = createFileRoute("/admin/refunds")({
  component: RefundsRoute,
})

function RefundsRoute() {
  return (
    <AbilityRouteGuard
      action="access"
      subject="RefundsDashboard"
      deniedMessage="Directors or Delegates only."
    >
      <RefundsDashboard />
    </AbilityRouteGuard>
  )
}
