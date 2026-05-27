import { LayoutSidebar } from "@/components/layout/layout-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <LayoutSidebar />
      <SidebarInset>
        <div className="flex flex-col h-screen">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
