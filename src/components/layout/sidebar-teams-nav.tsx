import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { isParsedRecord, parseJson } from "@/lib/parsed-json"
import { cn } from "@/lib/utils"
import { useQuery } from "convex/react"
import { Link } from "@tanstack/react-router"
import {
  ChevronRightIcon,
  FolderKanbanIcon,
  ListChecksIcon,
  UsersIcon,
} from "lucide-react"
import { useState } from "react"

const TEAMS_OPEN_STORAGE_KEY = "sidebar:teams-open:v1"
type TeamsOpenState = Record<string, boolean>

function readTeamsOpenState(): TeamsOpenState {
  try {
    const raw = localStorage.getItem(TEAMS_OPEN_STORAGE_KEY)
    if (raw === null || raw === "") return {}
    const parsed = parseJson(raw)
    if (parsed === null || !isParsedRecord(parsed)) return {}

    const state: TeamsOpenState = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") {
        state[key] = value
      }
    }
    return state
  } catch {
    return {}
  }
}

function writeTeamsOpenState(state: TeamsOpenState) {
  try {
    localStorage.setItem(TEAMS_OPEN_STORAGE_KEY, JSON.stringify(state))
  } catch {
    void 0
  }
}

function TeamCollapsibleSection({
  open,
  sidebarPages,
  teamId,
  teamName,
  onOpenChange,
}: {
  open: boolean
  sidebarPages: { tasks: boolean; projects: boolean }
  teamId: Id<"teams">
  teamName: string
  onOpenChange: (teamId: Id<"teams">, open: boolean) => void
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(teamId, nextOpen)
      }}
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={teamName}>
            <UsersIcon />
            <span className="truncate">{teamName}</span>
            <ChevronRightIcon
              className={cn(
                "ml-auto size-4 shrink-0 transition-transform",
                open && "rotate-90"
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {sidebarPages.tasks ? (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild>
                  <Link
                    to="/teams/$teamId/tasks"
                    params={{ teamId }}
                    activeOptions={{ exact: true }}
                    activeProps={{ "data-active": true }}
                    inactiveProps={{ "data-active": false }}
                  >
                    <ListChecksIcon />
                    <span>Tasks</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ) : null}
            {sidebarPages.projects ? (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild>
                  <Link
                    to="/teams/$teamId/projects"
                    params={{ teamId }}
                    activeOptions={{ exact: true }}
                    activeProps={{ "data-active": true }}
                    inactiveProps={{ "data-active": false }}
                  >
                    <FolderKanbanIcon />
                    <span>Projects</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ) : null}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function SidebarTeamsNav() {
  const teams = useQuery(api.teams.queries.listForNavigation)
  const [openByTeamId, setOpenByTeamId] = useState(readTeamsOpenState)
  const visibleTeams = teams?.filter(
    (team) => team.sidebarPages.tasks || team.sidebarPages.projects
  )

  if (visibleTeams === undefined || visibleTeams.length === 0) {
    return null
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Teams</SidebarGroupLabel>
      <SidebarMenu>
        {visibleTeams.map((team) => (
          <TeamCollapsibleSection
            key={team._id}
            open={openByTeamId[team._id] ?? false}
            sidebarPages={team.sidebarPages}
            teamId={team._id}
            teamName={team.name}
            onOpenChange={(teamId, open) => {
              setOpenByTeamId((current) => {
                const next = { ...current, [teamId]: open }
                writeTeamsOpenState(next)
                return next
              })
            }}
          />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
