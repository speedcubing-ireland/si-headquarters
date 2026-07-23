import * as React from "react"
import {
  AwardIcon,
  BlocksIcon,
  FolderKanbanIcon,
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
  useSidebar,
} from "@/components/ui/sidebar"
import { SidebarTeamsNav } from "./sidebar-teams-nav"
import { SidebarUser } from "./layout-sidebar-user"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserImpersonationBanner } from "@/features/impersonation/impersonation-banner"
import { PLUGINS } from "@/plugins/registry"
import { Can } from "@/features/auth"
import { useAdminAccess } from "@/features/admin/use-admin-access"
import { organisationConfig } from "@/config/lib/organisation"

const homeLink = { label: "Home", to: "/" as const, icon: HomeIcon }

const achievementsLink = {
  label: "Achievements",
  href: "https://achievements.speedcubingireland.com",
  icon: AwardIcon,
}

const projectLinkItems: {
  label: string
  to: ToOptions["to"]
  icon: LucideIcon
}[] = [
  { label: "Tasks", to: "/tasks", icon: ListChecksIcon },
  { label: "Competitions", to: "/competitions", icon: TrophyIcon },
  { label: "Projects", to: "/projects", icon: FolderKanbanIcon },
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
              <span className="truncate font-medium">
                {organisationConfig.organisation.name}
              </span>
              <span className="truncate text-xs">
                {organisationConfig.organisation.productName}
              </span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function SidebarPluginLinks() {
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
  return <AdminAccessSidebarGroup />
}

function AdminAccessSidebarGroup() {
  const { isLoading, allowed } = useAdminAccess()

  if (isLoading || !allowed) {
    return null
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Admin</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Admin">
            <Link
              to="/admin"
              activeOptions={{ exact: true }}
              activeProps={{ "data-active": true }}
              inactiveProps={{ "data-active": false }}
            >
              <UsersIcon />
              <span>Admin</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}

function SidebarHomeLink() {
  return (
    <SidebarGroup>
      <SidebarMenu>
        <SidebarNavLink {...homeLink} />
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip={achievementsLink.label}>
            <a
              href={achievementsLink.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <achievementsLink.icon />
              <span>{achievementsLink.label}</span>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
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

function SidebarThemeToggle() {
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <ThemeToggle
          contentAlign="end"
          contentClassName="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
          contentSide={isMobile ? "bottom" : "right"}
          contentSideOffset={4}
          trigger={({ icon: Icon, label }) => (
            <SidebarMenuButton
              tooltip="Change theme"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Icon />
              <span>{label}</span>
            </SidebarMenuButton>
          )}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function LayoutSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarTitle />
        <UserImpersonationBanner />
      </SidebarHeader>
      <SidebarContent>
        <SidebarHomeLink />
        <SidebarProjectLinks />
        <SidebarTeamsNav />
        <SidebarPluginLinks />
        <SidebarAdminLinks />
      </SidebarContent>
      <SidebarFooter>
        <SidebarThemeToggle />
        <SidebarUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
