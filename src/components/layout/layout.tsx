import { LayoutSidebar } from "@/components/layout/layout-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <LayoutSidebar />
      <SidebarInset>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
