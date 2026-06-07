import { Page, PAGE_CONTENT_PADDING } from "@/components/layout/page"
import { AbilityRouteGuard } from "@/features/auth"
import { cn } from "@/lib/utils"
import {
  DashboardContent,
  DashboardRefreshButton,
} from "@/plugins/social-media/components/dashboard-content"
import { useSocialMediaDashboard } from "@/plugins/social-media/use-social-media-dashboard"

function SocialMediaDashboardContent() {
  const { competitions, error, isFetching, hasLoaded, refresh } =
    useSocialMediaDashboard()

  return (
    <Page.Root>
      <Page.Header>
        <Page.Title>Social Media</Page.Title>
        <Page.Actions>
          <DashboardRefreshButton isFetching={isFetching} onRefresh={refresh} />
        </Page.Actions>
      </Page.Header>
      <Page.Content className={cn(PAGE_CONTENT_PADDING, "flex flex-col gap-4")}>
        <DashboardContent
          competitions={competitions}
          error={error}
          isFetching={isFetching}
          hasLoaded={hasLoaded}
        />
      </Page.Content>
    </Page.Root>
  )
}

export function SocialMediaPage() {
  return (
    <AbilityRouteGuard
      action="access"
      subject="SocialMediaDashboard"
      deniedMessage="Volunteer access is required."
      loadingMessage="Loading Social Media…"
    >
      <SocialMediaDashboardContent />
    </AbilityRouteGuard>
  )
}
