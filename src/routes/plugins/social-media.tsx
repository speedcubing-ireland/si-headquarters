import { createFileRoute } from "@tanstack/react-router"
import { SocialMediaPage } from "@/plugins/social-media/social-media-page"
import {
  isSocialMediaTab,
  type SocialMediaTab,
} from "@/plugins/social-media/tabs"

export const Route = createFileRoute("/plugins/social-media")({
  validateSearch: (search: { tab?: string }): { tab?: SocialMediaTab } => ({
    tab:
      typeof search.tab === "string" && isSocialMediaTab(search.tab)
        ? search.tab
        : undefined,
  }),
  component: SocialMediaRoute,
})

function SocialMediaRoute() {
  const { tab } = Route.useSearch()
  return <SocialMediaPage activeTab={tab ?? "competitions"} />
}
