import type { LucideIcon } from "lucide-react"
import { ShieldAlertIcon, UsersIcon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminImpersonationPage } from "@/features/admin/impersonation"
import { isAdminTab, type AdminTab } from "@/features/admin/types"
import { AdminUsersPage } from "@/features/admin/users"
import { useAdminAccess } from "@/features/admin/use-admin-access"
import { cn } from "@/lib/utils"

interface AdminPageProps {
  initialTab?: string
  onTabChange?: (tab: AdminTab) => void
}

const ADMIN_TAB_CONFIG: Record<
  AdminTab,
  { label: string; icon: LucideIcon; content: () => ReactNode }
> = {
  users: {
    label: "Users",
    icon: UsersIcon,
    content: () => <AdminUsersPage />,
  },
  impersonation: {
    label: "Impersonation",
    icon: ShieldAlertIcon,
    content: () => <AdminImpersonationPage />,
  },
}

const ADMIN_TABS_GAP = "gap-4 @lg/main:gap-6"

function resolveActiveTab(
  availableTabs: readonly AdminTab[],
  preferredTab: string | undefined
): AdminTab | null {
  if (availableTabs.length === 0) {
    return null
  }
  if (
    preferredTab !== undefined &&
    isAdminTab(preferredTab) &&
    availableTabs.includes(preferredTab)
  ) {
    return preferredTab
  }
  return availableTabs[0]
}

function AdminTabsInner({
  availableTabs,
  initialTab,
  onTabChange,
}: {
  availableTabs: AdminTab[]
  initialTab?: string
  onTabChange?: (tab: AdminTab) => void
}) {
  const [activeTab, setActiveTab] = useState<AdminTab>(
    () => resolveActiveTab(availableTabs, initialTab) ?? availableTabs[0]
  )

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (!isAdminTab(value) || !availableTabs.includes(value)) {
          return
        }
        setActiveTab(value)
        onTabChange?.(value)
      }}
      className={cn("flex min-h-0 flex-1 flex-col", ADMIN_TABS_GAP)}
    >
      <TabsList className="w-fit">
        {availableTabs.map((tab) => {
          const { label, icon: Icon } = ADMIN_TAB_CONFIG[tab]
          return (
            <TabsTrigger key={tab} value={tab}>
              <Icon className="size-4" />
              {label}
            </TabsTrigger>
          )
        })}
      </TabsList>

      {availableTabs.map((tab) => {
        const { content } = ADMIN_TAB_CONFIG[tab]
        const isUsersTab = tab === "users"
        return (
          <TabsContent
            key={tab}
            value={tab}
            className={cn(
              "mt-0 outline-none",
              isUsersTab
                ? "flex min-h-0 flex-1 flex-col"
                : "min-h-0 flex-1 overflow-y-auto"
            )}
          >
            {content()}
          </TabsContent>
        )
      })}
    </Tabs>
  )
}

export function AdminPage({ initialTab, onTabChange }: AdminPageProps) {
  const { tabs: availableTabs, isLoading } = useAdminAccess()
  const defaultTab = resolveActiveTab(availableTabs, initialTab)

  if (isLoading || defaultTab === null) {
    return null
  }

  return (
    <AdminTabsInner
      key={`${defaultTab}-${availableTabs.join(",")}`}
      availableTabs={availableTabs}
      initialTab={initialTab}
      onTabChange={onTabChange}
    />
  )
}
