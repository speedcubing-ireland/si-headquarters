import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Can } from "@/features/auth"
import { CreateProjectDialog } from "@/features/projects/create/create-project-dialog"
import {
  ProjectCard,
  type ProjectCardSummary,
} from "@/features/projects/components/project-card"
import {
  isProjectStatusTab,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TABS,
} from "@/features/projects/project-status"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { ProjectStatus } from "@/convex/projects/statuses"
import { useQuery } from "convex/react"
import { useMemo, useState } from "react"

type ProjectScope = Doc<"projects">["scope"]
type ProjectStatusTab = ProjectStatus | "all"

function ProjectCardsPage({
  canCreate,
  emptyNoun,
  loadingMessage,
  scope,
  title,
}: {
  canCreate: boolean
  emptyNoun: string
  loadingMessage: string
  scope: ProjectScope
  title: string
}) {
  const [statusTab, setStatusTab] = useState<ProjectStatusTab>("all")
  const globalProjects = useQuery(
    api.projects.queries.listGlobalCards,
    scope.type === "global" ? {} : "skip"
  )
  const teamProjects = useQuery(
    api.projects.queries.listForTeamCards,
    scope.type === "teams" ? { teamId: scope.id } : "skip"
  )
  const projects = scope.type === "global" ? globalProjects : teamProjects

  const statusCounts = useMemo(() => {
    if (projects === undefined) return undefined

    const counts: Record<ProjectStatusTab, number> = {
      all: 0,
      planning: 0,
      active: 0,
      paused: 0,
      complete: 0,
      cancelled: 0,
    }

    counts.all = projects.length
    for (const project of projects) {
      counts[project.status] += 1
    }

    return counts
  }, [projects])

  const filteredProjects = useMemo(() => {
    if (projects === undefined) return undefined
    if (statusTab === "all") return projects
    return projects.filter(
      (project: ProjectCardSummary) => project.status === statusTab
    )
  }, [projects, statusTab])

  return (
    <Page.Root>
      <Page.Header>
        <Page.Title>{title}</Page.Title>
        <Page.Actions>
          {canCreate ? (
            scope.type === "global" ? (
              <Can I="create" a="Project">
                <CreateProjectDialog scope={scope} />
              </Can>
            ) : (
              <CreateProjectDialog scope={scope} />
            )
          ) : null}
        </Page.Actions>
      </Page.Header>
      <Page.Content
        className={`${PAGE_CONTENT_PADDING_SCROLL} flex flex-col gap-4 @lg/main:gap-6`}
      >
        <Tabs
          value={statusTab}
          onValueChange={(value: string) => {
            if (isProjectStatusTab(value)) {
              setStatusTab(value)
            }
          }}
        >
          <TabsList>
            {PROJECT_STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="gap-1.5">
                {tab === "all" ? "All" : PROJECT_STATUS_LABELS[tab]}
                {statusCounts !== undefined ? (
                  <span className="text-muted-foreground tabular-nums">
                    {statusCounts[tab]}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {filteredProjects === undefined ? (
          <Page.Status variant="loading" message={loadingMessage} />
        ) : filteredProjects.length === 0 ? (
          <Page.Status
            variant="empty"
            message={
              statusTab === "all"
                ? `No ${emptyNoun} yet.`
                : `No ${PROJECT_STATUS_LABELS[statusTab].toLowerCase()} ${emptyNoun}.`
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 @md/main:grid-cols-2 @xl/main:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProjectCard key={project._id} project={project} />
            ))}
          </div>
        )}
      </Page.Content>
    </Page.Root>
  )
}

export function ProjectsPage() {
  return (
    <ProjectCardsPage
      canCreate
      emptyNoun="projects"
      loadingMessage="Loading projects..."
      scope={{ type: "global" }}
      title="Projects"
    />
  )
}

export function TeamProjectsPage({ teamId }: { teamId: Id<"teams"> }) {
  const team = useQuery(api.teams.queries.getForTaskPage, { teamId })

  return (
    <ProjectCardsPage
      canCreate={team != null}
      emptyNoun="team projects"
      loadingMessage="Loading team projects..."
      scope={{ type: "teams", id: teamId }}
      title={
        team === undefined || team === null
          ? "Team projects"
          : `${team.name} projects`
      }
    />
  )
}
