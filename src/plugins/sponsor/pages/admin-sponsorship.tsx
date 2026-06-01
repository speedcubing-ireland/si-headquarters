import { Navigate } from "@tanstack/react-router"
import { Loader2, ShieldX } from "lucide-react"
import { isSponsorshipEnabled } from "@/lib/feature-flags"
import { SponsorshipAdminContent } from "@/plugins/sponsor/admin/sponsorship-admin-content"
import { useIsSponsorshipManager } from "@/plugins/sponsor/hooks/use-sponsorship"

export function AdminSponsorshipPage() {
  return <SponsorshipAdminRoute />
}

function SponsorshipAdminRoute() {
  if (!isSponsorshipEnabled) {
    return <Navigate to="/" />
  }
  return <SponsorshipAdminGate />
}

function SponsorshipAdminGate() {
  const { isManager, isLoading } = useIsSponsorshipManager()
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading sponsorship admin…
      </div>
    )
  }
  if (!isManager) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <ShieldX className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Directors or Finance Team access is required.
        </p>
      </div>
    )
  }
  return <SponsorshipAdminContent />
}
