import * as React from "react"
import {
  BlocksIcon,
  BookOpen,
  ListChecksIcon,
  Settings2,
  SquareTerminal,
  TrophyIcon,
  ChevronRight,
  type LucideIcon,
} from "lucide-react"
import { Link } from "@tanstack/react-router"
import type { ToOptions } from "@tanstack/react-router"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { SidebarUser } from "./layout-sidebar-user"

const dropdownItems = [
  {
    title: "Playground",
    icon: SquareTerminal,
    isActive: true,
    items: ["History", "Starred", "Settings"],
  },
  {
    title: "Documentation",
    icon: BookOpen,
    items: ["Introduction", "Get Started", "Tutorials", "Changelog"],
  },
  {
    title: "Settings",
    icon: Settings2,
    items: ["General", "Team", "Billing", "Limits"],
  },
]

const linkItems: { label: string; to: ToOptions["to"]; icon: LucideIcon }[] = [
  { label: "Tasks", to: "/tasks", icon: ListChecksIcon },
  { label: "Competitions", to: "/competitions", icon: TrophyIcon },
]

function SidebarTitle() {
  return (
    <div className="flex gap-2 px-2 pt-2">
      <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <BlocksIcon className="size-4" />
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">Speedcubing Ireland</span>
        <span className="truncate text-xs">Headquarters</span>
      </div>
    </div>
  )
}

function SidebarDropdowns() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {dropdownItems.map(({ title, icon: Icon, isActive, items }) => (
          <Collapsible
            key={title}
            asChild
            defaultOpen={isActive}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={title}>
                  <Icon />
                  <span>{title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {items.map((label) => (
                    <SidebarMenuSubItem key={label}>
                      <SidebarMenuSubButton asChild>
                        <a href="#">{label}</a>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function SidebarLinks() {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {linkItems.map(({ label, to, icon: Icon }) => (
          <SidebarMenuItem key={label}>
            <SidebarMenuButton asChild tooltip={label}>
              <Link
                to={to}
                activeProps={{ "data-active": true }}
                inactiveProps={{ "data-active": false }}
              >
                <Icon />
                <span>{label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export function LayoutSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarTitle />
      </SidebarHeader>
      <SidebarContent>
        <SidebarDropdowns />
        <SidebarLinks />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
