import { UserButton } from "@/components/data-selectors/user-button"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { useMutation } from "convex/react"
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
import { toast } from "sonner"

export function PeopleCard({ comp }: { comp: Doc<"competitions"> }) {
  const setCompLead = useMutation(api.competitions.mutations.setCompLead)
  const setLeadDelegate = useMutation(
    api.competitions.mutations.setLeadDelegate
  )
  const setOrganisers = useMutation(api.competitions.mutations.setOrganisers)

  return (
    <PageCard title="People" icon={<UserIcon className="size-4" />}>
      <PageCardContent className="flex-1">
        <PageCardRow
          icon={<ClipboardPenIcon className="size-4" />}
          label="Competition Lead"
        >
          <UserButton
            value={comp.people.compLead}
            onChange={(userId) => {
              void setCompLead({ id: comp._id, userId })
            }}
          />
        </PageCardRow>
        <PageCardRow
          icon={<FlagIcon className="size-4" />}
          label="Lead Delegate"
        >
          <UserButton
            value={comp.people.leadDelegate}
            onChange={(userId) => {
              void setLeadDelegate({ id: comp._id, userId })
            }}
          />
        </PageCardRow>
        <PageCardRow icon={<UsersIcon className="size-4" />} label="Organisers">
          <UserButton
            selectionMode="multiple"
            value={comp.people.organisers}
            onChange={(organiserIds) => {
              void setOrganisers({ id: comp._id, organiserIds })
            }}
          />
        </PageCardRow>
      </PageCardContent>
      <PageCardFooter>
        <Button
          className="w-full"
          onClick={() => {
            // TODO: implement invites
            toast.error("Invites not implemented  ask the software team")
          }}
        >
          <MessageCirclePlusIcon />
          Invite Organiser To HQ
        </Button>
      </PageCardFooter>
    </PageCard>
  )
}
