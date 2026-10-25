import { useNavigate } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { Page, PAGE_CONTENT_PADDING } from "@/components/layout/page"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AbilityRouteGuard } from "@/features/auth"
import { cn } from "@/lib/utils"
import {
  DashboardContent,
  DashboardRefreshButton,
} from "@/plugins/social-media/components/dashboard-content"
import { RecordsTab } from "@/plugins/social-media/components/records-tab"
import {
  isSocialMediaTab,
  SOCIAL_MEDIA_TABS,
  type SocialMediaTab,
} from "@/plugins/social-media/tabs"
import { useSocialMediaDashboard } from "@/plugins/social-media/use-social-media-dashboard"

function SocialMediaDashboardContent({
  activeTab,
}: {
  activeTab: SocialMediaTab
}) {
  const navigate = useNavigate({ from: "/plugins/social-media" })
  const { competitions, error, isFetching, hasLoaded, refresh } =
    useSocialMediaDashboard()

  const tabs: Record<
    SocialMediaTab,
    { actions: ReactNode; content: ReactNode }
  > = {
    competitions: {
      actions: (
        <DashboardRefreshButton isFetching={isFetching} onRefresh={refresh} />
      ),
      content: (
        <DashboardContent
          competitions={competitions}
          error={error}
          isFetching={isFetching}
          hasLoaded={hasLoaded}
        />
      ),
    },
    records: { actions: null, content: <RecordsTab /> },
  }

  return (
    <Page.Root>
      <Page.Header>
        <Page.Title>Social Media</Page.Title>
        <Page.Actions>{tabs[activeTab].actions}</Page.Actions>
      </Page.Header>
      <Page.Content className={cn(PAGE_CONTENT_PADDING, "flex flex-col gap-4")}>
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (isSocialMediaTab(value)) {
              void navigate({ search: { tab: value } })
            }
          }}
          className="mx-auto w-full max-w-6xl space-y-4"
        >
          <TabsList>
            {SOCIAL_MEDIA_TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {SOCIAL_MEDIA_TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              {tabs[tab.id].content}
            </TabsContent>
          ))}
        </Tabs>
      </Page.Content>
    </Page.Root>
  )
}

export function SocialMediaPage({ activeTab }: { activeTab: SocialMediaTab }) {
  return (
    <AbilityRouteGuard
      action="access"
      subject="SocialMediaDashboard"
      deniedMessage="Volunteer access is required."
      loadingMessage="Loading Social Media…"
    >
      <SocialMediaDashboardContent activeTab={activeTab} />
    </AbilityRouteGuard>
  )
}
