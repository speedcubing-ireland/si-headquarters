import { useChildQuery } from "@/hooks/convex/use-child-query"
import { useConfiguredToday } from "@/hooks/use-configured-today"
import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
import { CompetitionDetailsCard } from "@/features/competitions/components/details-card"
import { CompetitionPeopleCard } from "@/features/competitions/components/people-card"
import { CompetitionPropertiesCard } from "@/features/competitions/components/properties-card"
import { EditPhasesButton } from "@/features/phases/edit-phases-dialog"
import { SubtaskViewContent } from "@/features/subtasks/subtask-view"
import { CurrentUpdateCard } from "@/features/updates/current-update-card"
import { CommentsCardContainer } from "@/features/comments/comments-card-container"
import { ObjectPageGrid } from "@/features/shared/object-page-grid"
import { DeleteObjectBar } from "@/features/shared/delete-object-bar"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

export function CompetitionPage({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const today = useConfiguredToday()
  const navigate = useNavigate()
  const deleteCompetition = useMutation(
    api.competitions.mutations.deleteCompetition
  )
  const comp = useQuery(api.competitions.queries.getPageRoot, {
    id: competitionId,
  })

  const subtaskView = useChildQuery(
    api.tasks.queries.getSubtaskView,
    {
      owner: { type: "competitions", id: competitionId },
      today,
    },
    comp
  )

  const properties = useChildQuery(
    api.competitions.queries.getProperties,
    {
      id: competitionId,
    },
    comp
  )
  const peopleDetails = useChildQuery(
    api.competitions.queries.getPeople,
    {
      id: competitionId,
    },
    comp
  )

  return (
    <Page.Shell
      title={comp?.name ?? "Competition"}
      contentClassName={PAGE_CONTENT_PADDING_SCROLL}
    >
      <Page.EntityState
        value={comp}
        loadingMessage="Loading competition…"
        emptyMessage="Competition not found."
      >
        {(comp) => (
          <ObjectPageGrid>
            <CompetitionDetailsCard comp={comp} competitionId={competitionId} />
            <CompetitionPropertiesCard
              competitionId={competitionId}
              properties={properties}
            />
            <CompetitionPeopleCard
              competitionId={competitionId}
              peopleDetails={peopleDetails}
            />
            <CurrentUpdateCard
              object={{ type: "competitions", id: competitionId }}
              title="Competition update"
            />
            <SubtaskViewContent
              view={subtaskView}
              owner={{ type: "competitions", id: competitionId }}
              toolbarActions={
                <EditPhasesButton
                  owner={{ type: "competitions", id: competitionId }}
                />
              }
            />
            <CommentsCardContainer
              target={{ type: "competitions", id: competitionId }}
            />
            {comp.canDelete ? (
              <DeleteObjectBar
                objectLabel="competition"
                description="This permanently removes the competition and all of its owned work."
                confirmationDescription="All phases, tasks, comments, updates, linked resources, organiser invites, and draft sponsorship auctions belonging to it will also be deleted. Historical sponsorship auctions will be retained without the competition link."
                onDelete={async () => {
                  await deleteCompetition({ id: competitionId })
                  toast.success("Competition deleted")
                  await navigate({ to: "/competitions" })
                }}
              />
            ) : null}
          </ObjectPageGrid>
        )}
      </Page.EntityState>
    </Page.Shell>
  )
}
