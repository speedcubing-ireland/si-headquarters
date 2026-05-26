import { api } from "@/convex/_generated/api"
import { SubtaskView } from "@/features/subtasks/subtask-view"
import { useQuery } from "convex/react"
import { DetailsCard } from "./components/details/details-card"
import { PeopleCard } from "./components/people-card"
import { PropertiesCard } from "./components/properties-card"
import { UpdateCard } from "./components/updates/update-card"
import type { Id } from "@/convex/_generated/dataModel"

export function CompetitionPage({ competitionId } : {
  competitionId: Id<"competitions">
}) {
  
  const comp = useQuery(api.competitions.queries.getPageRoot, {
    id: competitionId
  })

  if (comp === null) return "Competition not found"

  if (!comp) {
    return <></>
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
      <DetailsCard comp={comp} />
      <PropertiesCard competitionId={competitionId} />
      <PeopleCard competitionId={competitionId} />
      <UpdateCard competitionId={competitionId} />
      <SubtaskView owner={{ type: "competitions", id: competitionId }} />
      <div className="h-96" />
    </div>
  )
}
