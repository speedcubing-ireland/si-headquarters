import { CompetitionPeopleCardFields } from "@/features/competitions/competition-people-selectors"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useQuery } from "convex/react"
import {
  ClipboardPenIcon,
  FlagIcon,
  MessageCirclePlusIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"
import {
  PageCard,
  PageCardContent,
  PageCardFooter,
  PageCardRow,
} from "../../../components/page-card"
import { Skeleton } from "@/components/ui/skeleton"

export function PeopleCard({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const peopleDetails = useQuery(api.competitions.queries.getPeople, {
    id: competitionId,
  })

  if (peopleDetails === undefined) {
    return (
      <PageCard title="People" icon={<UserIcon className="size-4" />}>
        <PageCardContent className="min-h-32 flex-1">
          <PageCardRow
            icon={<ClipboardPenIcon className="size-4" />}
            label="Competition Lead"
          >
            <Skeleton className="h-8 w-24" />
          </PageCardRow>
          <PageCardRow
            icon={<FlagIcon className="size-4" />}
            label="Lead Delegate"
          >
            <Skeleton className="h-8 w-24" />
          </PageCardRow>
          <PageCardRow
            icon={<UsersIcon className="size-4" />}
            label="Organisers"
          >
            <Skeleton className="h-8 w-24" />
          </PageCardRow>
        </PageCardContent>
        <PageCardFooter>
          <Button className="w-full" disabled>
            <MessageCirclePlusIcon />
            Invite Organiser To HQ
          </Button>
        </PageCardFooter>
      </PageCard>
    )
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
      <PageCardFooter>
        <Button className="w-full" noop>
          <MessageCirclePlusIcon />
          Invite Organiser To HQ
        </Button>
      </PageCardFooter>
    </PageCard>
  )
}
