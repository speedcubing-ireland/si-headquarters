import { CompetitionPeopleCardFields } from "@/features/competitions/competition-people-selectors"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useQuery } from "convex/react"
import { UserIcon } from "lucide-react"
import { PageCard, PageCardContent } from "@/components/page-card"

export function CompetitionPeopleCard({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const peopleDetails = useQuery(api.competitions.queries.getPeople, {
    id: competitionId,
  })

  if (peopleDetails === undefined) {
    return null
  }

  const { competition: comp, people } = peopleDetails

  return (
    <PageCard title="People" icon={<UserIcon className="size-4" />}>
      <PageCardContent className="flex-1">
        <CompetitionPeopleCardFields
          competitionId={competitionId}
          compLeadId={comp.people.compLead}
          leadDelegateId={comp.people.leadDelegate}
          organiserIds={comp.people.organisers}
          compLead={people.compLead}
          leadDelegate={people.leadDelegate}
          organisers={people.organisers}
        />
      </PageCardContent>
    </PageCard>
  )
}
