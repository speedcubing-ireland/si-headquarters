import InlineDataView from "@/components/data-views/inline-data-view"
import { api } from "@/convex/_generated/api"
import { useQuery } from "convex/react"
import { DetailsCard } from "./components/details/details-card"
import { PeopleCard } from "./components/people-card"
import { PropertiesCard } from "./components/properties-card"
import { UpdateCard } from "./components/updates/update-card"

export function CompetitionPage() {
  const comp = useQuery(api.competitions.queries.getPageRoot)

  if (!comp) {
    return <></>
  }

  const competitionId = comp._id

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
      <DetailsCard comp={comp} />
      <PropertiesCard competitionId={competitionId} />
      <PeopleCard competitionId={competitionId} />
      <UpdateCard competitionId={competitionId} />
      <InlineDataView />
      <div className="h-96" />
    </div>
  )
}
