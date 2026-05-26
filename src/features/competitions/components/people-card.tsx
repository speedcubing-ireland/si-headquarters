import { UserButton } from "@/components/data-selectors/user-button"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
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
import { toast } from "sonner"

function LoadingValue() {
  return <Skeleton className="h-8 w-24" />
}

export function PeopleCard({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const peopleDetails = useQuery(api.competitions.queries.getPeople, {
    id: competitionId,
  })
  const setCompLead = useMutation(api.competitions.mutations.setCompLead)
  const setLeadDelegate = useMutation(
    api.competitions.mutations.setLeadDelegate
  )
  const setOrganisers = useMutation(api.competitions.mutations.setOrganisers)

  if (peopleDetails === undefined) {
    return (
      <PageCard title="People" icon={<UserIcon className="size-4" />}>
        <PageCardContent className="min-h-32 flex-1">
          <PageCardRow
            icon={<ClipboardPenIcon className="size-4" />}
            label="Competition Lead"
          >
            <LoadingValue />
          </PageCardRow>
          <PageCardRow
            icon={<FlagIcon className="size-4" />}
            label="Lead Delegate"
          >
            <LoadingValue />
          </PageCardRow>
          <PageCardRow
            icon={<UsersIcon className="size-4" />}
            label="Organisers"
          >
            <LoadingValue />
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
        <PageCardRow
          icon={<ClipboardPenIcon className="size-4" />}
          label="Competition Lead"
        >
          <UserButton
            selectedUser={people.compLead}
            value={comp.people.compLead}
            onChange={(userId) => {
              void setCompLead({ id: competitionId, userId })
            }}
          />
        </PageCardRow>
        <PageCardRow
          icon={<FlagIcon className="size-4" />}
          label="Lead Delegate"
        >
          <UserButton
            selectedUser={people.leadDelegate}
            value={comp.people.leadDelegate}
            onChange={(userId) => {
              void setLeadDelegate({ id: competitionId, userId })
            }}
          />
        </PageCardRow>
        <PageCardRow icon={<UsersIcon className="size-4" />} label="Organisers">
          <UserButton
            selectionMode="multiple"
            selectedUsers={people.organisers}
            value={comp.people.organisers}
            onChange={(organiserIds) => {
              void setOrganisers({ id: competitionId, organiserIds })
            }}
          />
        </PageCardRow>
      </PageCardContent>
      <PageCardFooter>
        <Button
          className="w-full"
          noop
        >
          <MessageCirclePlusIcon />
          Invite Organiser To HQ
        </Button>
      </PageCardFooter>
    </PageCard>
  )
}
