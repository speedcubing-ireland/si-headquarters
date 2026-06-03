import { createFileRoute } from "@tanstack/react-router"
import { UserImpersonationRedeem } from "@/features/impersonation/user-redeem"

export const Route = createFileRoute("/impersonate/user")({
  component: UserImpersonationRedeem,
})
