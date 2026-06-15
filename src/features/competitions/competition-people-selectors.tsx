import * as UserSelector from "@/components/data-selectors/user-selector"
import { PageCardRow } from "@/components/page-card"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import type { PublicUser } from "@/convex/users/validators"
import { useCan } from "@/features/auth"
import type { CompetitionCalendarCompetitionRow } from "@/features/competitions/list/competition-calendar-display"
import { useMutation } from "convex/react"
import type { LucideIcon } from "lucide-react"
import { ClipboardPenIcon, FlagIcon, UsersIcon } from "lucide-react"
import type { ReactNode } from "react"

const listIconProps = {
  variant: "icon" as const,
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

function CompetitionPeopleSelectors({
  competitionId,
  compLead,
  leadDelegate,
  organisers,
  compLeadId,
  leadDelegateId,
  organiserIds,
  onCompLeadChange,
  onLeadDelegateChange,
  onOrganisersChange,
  singleAppearance,
}: {
  competitionId: Id<"competitions">
  compLead: PublicUser | null
  leadDelegate: PublicUser | null
  organisers: PublicUser[]
  compLeadId: Id<"users"> | null
  leadDelegateId: Id<"users"> | null
  organiserIds: Id<"users">[]
  onCompLeadChange: (userId: Id<"users"> | null) => void
  onLeadDelegateChange: (userId: Id<"users"> | null) => void
  onOrganisersChange: (organiserIds: Id<"users">[]) => void
  singleAppearance: "property" | "icon"
}) {
  const SingleButton =
    singleAppearance === "icon"
      ? UserSelector.SingleIconButton
      : UserSelector.SinglePropertyButton
  const MultiButton =
    singleAppearance === "icon"
      ? UserSelector.MultiIconButton
      : UserSelector.MultiPropertyButton
  const buttonProps = singleAppearance === "icon" ? listIconProps : {}

  return (
    <>
      <ListPeopleSlot icon={ClipboardPenIcon} label="Lead">
        <SingleButton
          {...buttonProps}
          selectedUser={compLead}
          teamName={TEAM_NAMES.COMPETITIONS}
          competitionId={competitionId}
          value={compLeadId}
          onChange={onCompLeadChange}
        />
      </ListPeopleSlot>
      <ListPeopleSlot icon={FlagIcon} label="Delegate">
        <SingleButton
          {...buttonProps}
          selectedUser={leadDelegate}
          teamName={TEAM_NAMES.DELEGATES}
          competitionId={competitionId}
          value={leadDelegateId}
          onChange={onLeadDelegateChange}
        />
      </ListPeopleSlot>
      <ListPeopleSlot icon={UsersIcon} label="Organisers">
        <MultiButton
          {...buttonProps}
          maxAvatars={singleAppearance === "icon" ? 3 : undefined}
          selectedUsers={organisers}
          competitionId={competitionId}
          value={organiserIds}
          onChange={onOrganisersChange}
        />
      </ListPeopleSlot>
    </>
  )
}

function CompetitionPeopleFaces({
  compLead,
  leadDelegate,
  organisers,
  singleAppearance,
}: {
  compLead: PublicUser | null
  leadDelegate: PublicUser | null
  organisers: PublicUser[]
  singleAppearance: "property" | "icon"
}) {
  const avatarProps =
    singleAppearance === "icon" ? listIconProps.avatarProps : undefined

  return (
    <>
      <ListPeopleSlot icon={ClipboardPenIcon} label="Lead">
        <UserSelector.Face
          appearance={singleAppearance}
          avatarProps={avatarProps}
          users={compLead === null ? [] : [compLead]}
        />
      </ListPeopleSlot>
      <ListPeopleSlot icon={FlagIcon} label="Delegate">
        <UserSelector.Face
          appearance={singleAppearance}
          avatarProps={avatarProps}
          users={leadDelegate === null ? [] : [leadDelegate]}
        />
      </ListPeopleSlot>
      <ListPeopleSlot icon={UsersIcon} label="Organisers">
        <UserSelector.Face
          appearance={singleAppearance}
          avatarProps={avatarProps}
          maxAvatars={singleAppearance === "icon" ? 3 : undefined}
          users={organisers}
        />
      </ListPeopleSlot>
    </>
  )
}

function useCompetitionPeopleMutations(competitionId: Id<"competitions">) {
  const setCompLead = useMutation(api.competitions.mutations.setCompLead)
  const setLeadDelegate = useMutation(
    api.competitions.mutations.setLeadDelegate
  )
  const setOrganisers = useMutation(api.competitions.mutations.setOrganisers)

  return {
    onCompLeadChange: (userId: Id<"users"> | null) => {
      void setCompLead({ id: competitionId, userId })
    },
    onLeadDelegateChange: (userId: Id<"users"> | null) => {
      void setLeadDelegate({ id: competitionId, userId })
    },
    onOrganisersChange: (organiserIds: Id<"users">[]) => {
      void setOrganisers({ id: competitionId, organiserIds })
    },
  }
}

export function CompetitionCalendarPeopleFields({
  row,
}: {
  row: CompetitionCalendarCompetitionRow
}) {
  const { allowed: canManageCompetition } = useCan("manage", "Competition")
  const mutations = useCompetitionPeopleMutations(row._id)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5">
      {canManageCompetition ? (
        <CompetitionPeopleSelectors
          competitionId={row._id}
          compLead={row.compLead}
          leadDelegate={row.leadDelegate}
          organisers={row.organisers}
          compLeadId={row.compLead?._id ?? null}
          leadDelegateId={row.leadDelegate?._id ?? null}
          organiserIds={row.organisers.map((person) => person._id)}
          singleAppearance="icon"
          {...mutations}
        />
      ) : (
        <CompetitionPeopleFaces
          compLead={row.compLead}
          leadDelegate={row.leadDelegate}
          organisers={row.organisers}
          singleAppearance="icon"
        />
      )}
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
  const { allowed: canManageCompetition } = useCan("manage", "Competition")
  const mutations = useCompetitionPeopleMutations(competitionId)

  if (!canManageCompetition) {
    return (
      <>
        <PageCardRow
          icon={<ClipboardPenIcon className="size-4" />}
          label="Competition Lead"
        >
          <UserSelector.Face
            appearance="property"
            users={compLead === null ? [] : [compLead]}
          />
        </PageCardRow>
        <PageCardRow
          icon={<FlagIcon className="size-4" />}
          label="Lead Delegate"
        >
          <UserSelector.Face
            appearance="property"
            users={leadDelegate === null ? [] : [leadDelegate]}
          />
        </PageCardRow>
        <PageCardRow icon={<UsersIcon className="size-4" />} label="Organisers">
          <UserSelector.Face appearance="property" users={organisers} />
        </PageCardRow>
      </>
    )
  }

  return (
    <>
      <PageCardRow
        icon={<ClipboardPenIcon className="size-4" />}
        label="Competition Lead"
      >
        <UserSelector.SinglePropertyButton
          selectedUser={compLead}
          teamName={TEAM_NAMES.COMPETITIONS}
          competitionId={competitionId}
          value={compLeadId}
          onChange={mutations.onCompLeadChange}
        />
      </PageCardRow>
      <PageCardRow icon={<FlagIcon className="size-4" />} label="Lead Delegate">
        <UserSelector.SinglePropertyButton
          selectedUser={leadDelegate}
          teamName={TEAM_NAMES.DELEGATES}
          competitionId={competitionId}
          value={leadDelegateId}
          onChange={mutations.onLeadDelegateChange}
        />
      </PageCardRow>
      <PageCardRow icon={<UsersIcon className="size-4" />} label="Organisers">
        <UserSelector.MultiPropertyButton
          selectedUsers={organisers}
          competitionId={competitionId}
          value={organiserIds}
          onChange={mutations.onOrganisersChange}
        />
      </PageCardRow>
    </>
  )
}
