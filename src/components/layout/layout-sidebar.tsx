import * as React from "react"
import {
  BlocksIcon,
  HomeIcon,
  ListChecksIcon,
  UsersIcon,
  TrophyIcon,
  type LucideIcon,
} from "lucide-react"
import { Link } from "@tanstack/react-router"
import type { ToOptions } from "@tanstack/react-router"
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
} from "@/components/ui/sidebar"
import { SidebarTeamsNav } from "./sidebar-teams-nav"
import { SidebarUser } from "./layout-sidebar-user"
import { PLUGINS } from "@/plugins/registry"
import { isSponsorshipEnabled } from "@/lib/feature-flags"
import { Can } from "@/features/auth"

const homeLink = { label: "Home", to: "/" as const, icon: HomeIcon }

const projectLinkItems: {
  label: string
  to: ToOptions["to"]
  icon: LucideIcon
}[] = [
  { label: "Tasks", to: "/tasks", icon: ListChecksIcon },
  { label: "Competitions", to: "/competitions", icon: TrophyIcon },
]

const sidebarLinkActiveOptions = { exact: true } as const

function SidebarNavLink({
  label,
  to,
  icon: Icon,
}: {
  label: string
  to: ToOptions["to"]
  icon: LucideIcon
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={label}>
        <Link
          to={to}
          activeOptions={sidebarLinkActiveOptions}
          activeProps={{ "data-active": true }}
          inactiveProps={{ "data-active": false }}
        >
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function SidebarTitle() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild size="lg" tooltip="Home">
          <Link to="/">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <BlocksIcon className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Speedcubing Ireland</span>
              <span className="truncate text-xs">Headquarters</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function SidebarPluginLinks() {
  if (!isSponsorshipEnabled) {
    return null
  }

  const pluginNav = PLUGINS.flatMap((plugin) => plugin.nav)
  if (pluginNav.length === 0) {
    return null
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Plugins</SidebarGroupLabel>
      <SidebarMenu>
        {pluginNav.map(({ label, to, icon: Icon, ability }) => {
          const item = (
            <SidebarMenuItem key={label}>
              <SidebarMenuButton asChild tooltip={label}>
                <Link
                  to={to}
                  activeOptions={sidebarLinkActiveOptions}
                  activeProps={{ "data-active": true }}
                  inactiveProps={{ "data-active": false }}
                >
                  <Icon />
                  <span>{label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )

          if (!ability) {
            return item
          }

          return (
            <Can key={label} I={ability.action} a={ability.subject}>
              {item}
            </Can>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function SidebarAdminLinks() {
  return (
    <Can I="manage" a="UserManagement">
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Admin</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Users">
              <Link
                to="/admin"
                activeOptions={sidebarLinkActiveOptions}
                activeProps={{ "data-active": true }}
                inactiveProps={{ "data-active": false }}
              >
                <UsersIcon />
                <span>Users</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </Can>
  )
}

function SidebarHomeLink() {
  return (
    <SidebarGroup>
      <SidebarMenu>
        <SidebarNavLink {...homeLink} />
      </SidebarMenu>
    </SidebarGroup>
  )
}

function SidebarProjectLinks() {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {projectLinkItems.map((item) => (
          <SidebarNavLink key={item.label} {...item} />
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
        <SidebarHomeLink />
        <SidebarProjectLinks />
        <SidebarTeamsNav />
        <SidebarPluginLinks />
        <SidebarAdminLinks />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
