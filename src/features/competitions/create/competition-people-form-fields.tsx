import * as UserSelector from "@/components/data-selectors/user-selector"
import { Field, FieldLabel } from "@/components/ui/field"
import type { Id } from "@/convex/_generated/dataModel"
import { TEAM_NAMES } from "@/convex/permissions/shared"

export function CompetitionPeopleFormFields({
  compLeadId,
  leadDelegateId,
  organiserIds,
  disabled,
  onCompLeadChange,
  onLeadDelegateChange,
  onOrganisersChange,
}: {
  compLeadId: Id<"users"> | null
  leadDelegateId: Id<"users"> | null
  organiserIds: Id<"users">[]
  disabled?: boolean
  onCompLeadChange: (userId: Id<"users"> | null) => void
  onLeadDelegateChange: (userId: Id<"users"> | null) => void
  onOrganisersChange: (organiserIds: Id<"users">[]) => void
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Field>
        <FieldLabel>Competition Lead</FieldLabel>
        <UserSelector.SinglePropertyButton
          teamName={TEAM_NAMES.COMPETITIONS}
          value={compLeadId}
          disabled={disabled}
          className="w-full"
          onChange={onCompLeadChange}
        />
      </Field>
      <Field>
        <FieldLabel>Lead Delegate</FieldLabel>
        <UserSelector.SinglePropertyButton
          teamName={TEAM_NAMES.DELEGATES}
          value={leadDelegateId}
          disabled={disabled}
          className="w-full"
          onChange={onLeadDelegateChange}
        />
      </Field>
      <Field>
        <FieldLabel>Organisers</FieldLabel>
        <UserSelector.MultiPropertyButton
          value={organiserIds}
          disabled={disabled}
          className="w-full"
          onChange={onOrganisersChange}
        />
      </Field>
    </div>
  )
}
