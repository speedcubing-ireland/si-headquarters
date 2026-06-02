import { api } from "@/convex/_generated/api"
import { SubtaskView } from "@/features/subtasks/subtask-view"
import { useQuery } from "convex/react"
import { DetailsCard } from "./components/details/details-card"
import { PeopleCard } from "./components/people-card"
import { PropertiesCard } from "./components/properties-card"
import { UpdateCard } from "./components/updates/update-card"
import type { Id } from "@/convex/_generated/dataModel"
import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"

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
      {comp === undefined ? (
        <Page.Status variant="loading" message="Loading competition…" />
      ) : comp === null ? (
        <Page.Status variant="empty" message="Competition not found." />
      ) : (
        <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 @sm/main:grid-cols-2">
          <DetailsCard comp={comp} />
          <PropertiesCard competitionId={competitionId} />
          <PeopleCard competitionId={competitionId} />
          <UpdateCard competitionId={competitionId} />
          <SubtaskView owner={{ type: "competitions", id: competitionId }} />
        </div>
      )}
    </Page.Shell>
  )
}
