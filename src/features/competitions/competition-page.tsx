import InlineDataView from "@/components/data-views/inline-data-view"
import { api } from "@/convex/_generated/api"
import { useQuery } from "convex/react"
import { DetailsCard } from "./components/details/details-card"
import { PeopleCard } from "./components/people-card"
import { PropertiesCard } from "./components/properties-card"
import { UpdateCard } from "./components/update-card"

export function CompetitionPage() {
  const comp = useQuery(api.competitions.queries.getFakeComp)

  if (!comp) return <></>

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
      <DetailsCard comp={comp} />
      <PropertiesCard comp={comp} />
      <PeopleCard comp={comp} />
      <UpdateCard />
      <InlineDataView />
      <div className="h-96" />
    </div>
  )
}
