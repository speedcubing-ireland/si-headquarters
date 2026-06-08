import { Page, PAGE_CONTENT_PADDING } from "@/components/layout/page"
import { AbilityRouteGuard } from "@/features/auth"
import { cn } from "@/lib/utils"
import { SponsorshipAdminContent } from "@/plugins/sponsor/admin/sponsorship-admin-content"

export function SponsorshipAdminPage() {
  return (
    <AbilityRouteGuard
      action="access"
      subject="SponsorPortalAdmin"
      deniedMessage="Directors or Finance Team access is required."
      loadingMessage="Loading sponsorship admin…"
    >
      <Page.Shell
        title="Sponsorship"
        contentClassName={cn(PAGE_CONTENT_PADDING, "flex flex-col gap-4")}
      >
        <SponsorshipAdminContent />
      </Page.Shell>
    </AbilityRouteGuard>
  )
}
