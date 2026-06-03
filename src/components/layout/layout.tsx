import { LayoutSidebar } from "@/components/layout/layout-sidebar"
import { MainContainerProvider } from "@/components/layout/main-container-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { UserImpersonationBanner } from "@/features/impersonation/impersonation-banner"

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <LayoutSidebar />
      <SidebarInset className="@container/main">
        <UserImpersonationBanner />
        <MainContainerProvider>{children}</MainContainerProvider>
      </SidebarInset>
    </SidebarProvider>
  )
}
