import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/admin/impersonation")({
  component: AdminImpersonationRedirect,
})

function AdminImpersonationRedirect() {
  return <Navigate to="/admin" search={{ tab: "impersonation" }} />
}
