import { createFileRoute } from "@tanstack/react-router"
import { Page, PAGE_CONTENT_PADDING } from "@/components/layout/page"
import { AdminAccessGuard } from "@/features/admin/admin-access-guard"
import { cn } from "@/lib/utils"
import { AdminPage } from "@/features/admin/admin-page"
import { useAdminTabNavigation } from "@/features/admin/admin-tab-navigation"
import { isAdminTab } from "@/features/admin/types"

interface AdminSearch {
  tab?: string
}

export const Route = createFileRoute("/admin/")({
  validateSearch: (search: { tab?: string }): AdminSearch => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: AdminRoute,
})

function AdminRoute() {
  const { tab } = Route.useSearch()
  const setTab = useAdminTabNavigation("/admin/")

  return (
    <AdminAccessGuard>
      <Page.Shell
        title="Admin"
        contentClassName={cn(
          PAGE_CONTENT_PADDING,
          "flex min-h-0 flex-1 flex-col overflow-hidden"
        )}
      >
        <AdminPage
          initialTab={tab}
          onTabChange={(nextTab) => {
            if (isAdminTab(nextTab)) {
              setTab(nextTab)
            }
          }}
        />
      </Page.Shell>
    </AdminAccessGuard>
  )
}
