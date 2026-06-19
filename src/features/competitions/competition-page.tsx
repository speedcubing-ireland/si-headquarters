import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
import { CompetitionDetailsCard } from "@/features/competitions/components/details-card"
import { CompetitionPeopleCard } from "@/features/competitions/components/people-card"
import { CompetitionPropertiesCard } from "@/features/competitions/components/properties-card"
import { EditPhasesButton } from "@/features/phases/edit-phases-dialog"
import { SubtaskView } from "@/features/subtasks/subtask-view"
import { CurrentUpdateCard } from "@/features/updates/current-update-card"
import { CommentsCardContainer } from "@/features/comments/comments-card-container"
import { ObjectPageGrid } from "@/features/shared/object-page-grid"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useQuery } from "convex/react"

export function CompetitionPage({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const comp = useQuery(api.competitions.queries.getPageRoot, {
    id: competitionId,
  })

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
            <CompetitionPropertiesCard competitionId={competitionId} />
            <CompetitionPeopleCard competitionId={competitionId} />
            <CurrentUpdateCard
              object={{ type: "competitions", id: competitionId }}
              title="Competition update"
            />
            <SubtaskView
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
          </ObjectPageGrid>
        )}
      </Page.EntityState>
    </Page.Shell>
  )
}
