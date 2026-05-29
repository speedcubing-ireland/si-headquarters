import * as UserSelector from "@/components/data-selectors/user-selector"
import { PageCardRow } from "@/components/page-card"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import type { CompetitionCalendarCompetitionRow } from "@/features/competitions/list/competition-calendar-display"
import { useMutation } from "convex/react"
import type { LucideIcon } from "lucide-react"
import {
  ClipboardPenIcon,
  FlagIcon,
  UsersIcon,
} from "lucide-react"
import type { ReactNode } from "react"

const listIconProps = {
  variant: "ghost" as const,
  size: "icon-sm" as const,
  avatarProps: { size: "sm" as const },
}

function ListPeopleSlot({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="sr-only">{label}</span>
      {children}
    </span>
  )
}

export function CompetitionCalendarPeopleFields({
  row,
}: {
  row: CompetitionCalendarCompetitionRow
}) {
  const setCompLead = useMutation(api.competitions.mutations.setCompLead)
  const setLeadDelegate = useMutation(
    api.competitions.mutations.setLeadDelegate
  )
  const setOrganisers = useMutation(api.competitions.mutations.setOrganisers)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5">
      <ListPeopleSlot icon={ClipboardPenIcon} label="Lead">
        <UserSelector.SingleIconButton
          {...listIconProps}
          selectedUser={row.compLead}
          value={row.compLead?._id ?? null}
          onChange={(userId) => {
            void setCompLead({ id: row._id, userId })
          }}
        />
      </ListPeopleSlot>
      <ListPeopleSlot icon={FlagIcon} label="Delegate">
        <UserSelector.SingleIconButton
          {...listIconProps}
          selectedUser={row.leadDelegate}
          value={row.leadDelegate?._id ?? null}
          onChange={(userId) => {
            void setLeadDelegate({ id: row._id, userId })
          }}
        />
      </ListPeopleSlot>
      <ListPeopleSlot icon={UsersIcon} label="Organisers">
        <UserSelector.MultiIconButton
          {...listIconProps}
          maxAvatars={3}
          selectedUsers={row.organisers}
          value={row.organisers.map((person) => person._id)}
          onChange={(organiserIds) => {
            void setOrganisers({ id: row._id, organiserIds })
          }}
        />
      </ListPeopleSlot>
    </div>
  )
}

export function CompetitionPeopleCardFields({
  competitionId,
  compLeadId,
  leadDelegateId,
  organiserIds,
  compLead,
  leadDelegate,
  organisers,
}: {
  competitionId: Id<"competitions">
  compLeadId: Id<"users"> | null
  leadDelegateId: Id<"users"> | null
  organiserIds: Id<"users">[]
  compLead: PublicUser | null
  leadDelegate: PublicUser | null
  organisers: PublicUser[]
}) {
  const setCompLead = useMutation(api.competitions.mutations.setCompLead)
  const setLeadDelegate = useMutation(
    api.competitions.mutations.setLeadDelegate
  )
  const setOrganisers = useMutation(api.competitions.mutations.setOrganisers)

  return (
    <>
      <PageCardRow
        icon={<ClipboardPenIcon className="size-4" />}
        label="Competition Lead"
      >
        <UserSelector.SinglePropertyButton
          selectedUser={compLead}
          value={compLeadId}
          onChange={(userId) => {
            void setCompLead({ id: competitionId, userId })
          }}
        />
      </PageCardRow>
      <PageCardRow
        icon={<FlagIcon className="size-4" />}
        label="Lead Delegate"
      >
        <UserSelector.SinglePropertyButton
          selectedUser={leadDelegate}
          value={leadDelegateId}
          onChange={(userId) => {
            void setLeadDelegate({ id: competitionId, userId })
          }}
        />
      </PageCardRow>
      <PageCardRow icon={<UsersIcon className="size-4" />} label="Organisers">
        <UserSelector.MultiPropertyButton
          selectedUsers={organisers}
          value={organiserIds}
          onChange={(organiserIds) => {
            void setOrganisers({ id: competitionId, organiserIds })
          }}
        />
      </PageCardRow>
    </>
  )
}
