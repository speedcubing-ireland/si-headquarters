import { Navigate } from "@tanstack/react-router"
import { Page, PAGE_CONTENT_PADDING } from "@/components/layout/page"
import { cn } from "@/lib/utils"
import { AbilityRouteGuard } from "@/features/auth"
import { isSponsorshipEnabled } from "@/lib/feature-flags"
import { SponsorshipAdminContent } from "@/plugins/sponsor/admin/sponsorship-admin-content"

export function AdminSponsorshipPage() {
  if (!isSponsorshipEnabled) {
    return <Navigate to="/" />
  }

  return (
    <AbilityRouteGuard
      action="access"
      subject="SponsorPortalAdmin"
      deniedMessage="Directors or Finance Team access is required."
      loadingMessage="Loading sponsorship admin…"
    >
      <Page.Shell
        title="Sponsorship Admin"
        contentClassName={cn(PAGE_CONTENT_PADDING, "flex flex-col gap-4")}
      >
        <SponsorshipAdminContent />
      </Page.Shell>
    </AbilityRouteGuard>
  )
}
