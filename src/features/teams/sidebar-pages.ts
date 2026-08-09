import { FolderKanbanIcon, ListChecksIcon } from "lucide-react"
import type { TeamSidebarPage } from "@/convex/teams/validators"

export const TEAM_SIDEBAR_PAGE_ITEMS = [
  {
    page: "tasks",
    label: "Tasks",
    to: "/teams/$teamId/tasks",
    icon: ListChecksIcon,
  },
  {
    page: "projects",
    label: "Projects",
    to: "/teams/$teamId/projects",
    icon: FolderKanbanIcon,
  },
] as const satisfies readonly {
  page: TeamSidebarPage
  label: string
  to: "/teams/$teamId/tasks" | "/teams/$teamId/projects"
  icon: typeof ListChecksIcon
}[]
