import { api } from "@/convex/_generated/api"
import { SubtaskView } from "@/features/subtasks/subtask-view"
import { useQuery } from "convex/react"
import { DetailsCard } from "./components/details/details-card"
import { PeopleCard } from "./components/people-card"
import { PropertiesCard } from "./components/properties-card"
import { UpdateCard } from "./components/updates/update-card"
import type { Id } from "@/convex/_generated/dataModel"
import { NavBreadcrumbs, NavRoot } from "@/components/layout/layout-navbar"


function CompNavbar({ compName }: { 
  compName: string
}) {
  return (
    <NavRoot>
      <NavBreadcrumbs
        items={[{
          key: compName,
          label: compName
        }]}
      />
    </NavRoot>
  )
}

export function CompetitionPage({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const comp = useQuery(api.competitions.queries.getPageRoot, {
    id: competitionId,
  })

  if (comp === null) return "Competition not found"

  if (!comp) {
    return <></>
  }

  return (
    <>
      <CompNavbar compName={comp.name} />
      <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2 pb-10">
        <DetailsCard comp={comp} />
        <PropertiesCard competitionId={competitionId} />
        <PeopleCard competitionId={competitionId} />
        <UpdateCard competitionId={competitionId} />
        <SubtaskView owner={{ type: "competitions", id: competitionId }} />
      </div>
    </>
  )
}
