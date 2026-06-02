import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
import { DetailsCard } from "@/features/competitions/components/details/details-card"
import { PeopleCard } from "@/features/competitions/components/people-card"
import { PropertiesCard } from "@/features/competitions/components/properties-card"
import { UpdateCard } from "@/features/competitions/components/updates/update-card"
import { SubtaskView } from "@/features/subtasks/subtask-view"
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
          <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 @sm/main:grid-cols-2">
            <DetailsCard comp={comp} competitionId={competitionId} />
            <PropertiesCard competitionId={competitionId} />
            <PeopleCard competitionId={competitionId} />
            <UpdateCard competitionId={competitionId} />
            <SubtaskView owner={{ type: "competitions", id: competitionId }} />
          </div>
        )}
      </Page.EntityState>
    </Page.Shell>
  )
}
