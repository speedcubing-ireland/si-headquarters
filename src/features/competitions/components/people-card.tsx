import { CompetitionPeopleCardFields } from "@/features/competitions/competition-people-selectors"
import { OrganiserInviteButton } from "@/features/competitions/components/organiser-invite-button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Can } from "@/features/auth"
import { useQuery } from "convex/react"
import { UserIcon } from "lucide-react"
import {
  PageCard,
  PageCardContent,
  PageCardFooter,
} from "@/components/page-card"

export function CompetitionPeopleCard({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const peopleDetails = useQuery(api.competitions.queries.getPeople, {
    id: competitionId,
  })
  const wcaLoginConfigured = useQuery(
    api.organisers.queries.wcaLoginConfigured,
    {}
  )

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
      <Can I="manage" a="Competition">
        {wcaLoginConfigured === true ? (
          <PageCardFooter>
            <OrganiserInviteButton competitionId={competitionId} />
          </PageCardFooter>
        ) : null}
      </Can>
    </PageCard>
  )
}
