import { ObjectAvatar } from "@/components/object-avatar"
import { selectorGroup } from "@/components/data-selectors/selector-groups"
import { SingleSelectorCombobox } from "@/components/data-selectors/selector-combobox"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import { useQuery } from "convex/react"
import type { ReactNode } from "react"

type OwnerRef = Doc<"tasks">["owner"]
type OwnerType = NonNullable<OwnerRef>["type"]
type Team = Doc<"teams">
type OwnerByType = {
  users: PublicUser
  teams: Team
}
type OwnerOption = {
  face: ReactNode
  label: string
  value: NonNullable<OwnerRef>
}

const getOwnerName = (owner: { name?: string }) => owner.name ?? "Unknown"

function OwnerFace<TType extends OwnerType>({
  owner,
}: {
  owner: OwnerByType[TType]
}) {
  return (
    <>
      <ObjectAvatar obj={owner} size="sm" />
      {getOwnerName(owner)}
    </>
  )
}

function createOwnerOption<TType extends OwnerType>(
  objectType: TType,
  owner: OwnerByType[TType]
): OwnerOption {
  return {
    face: <OwnerFace owner={owner} />,
    label: getOwnerName(owner),
    value: { type: objectType, id: owner._id },
  }
}

function createOwnerGroup(
  key: "users" | "teams",
  label: string,
  items: OwnerOption[] | undefined
) {
  return selectorGroup({
    key,
    label,
    items,
    getLabel: (owner: OwnerOption) => owner.label,
    getValue: (owner: OwnerOption) => owner.value,
    renderItem: (owner: OwnerOption) => owner.face,
  })
}

export function TaskOwnerButton({
  value,
  onChange,
}: {
  value: OwnerRef
  onChange: (value: OwnerRef) => void | Promise<void> | Promise<null>
}) {
  const users = useQuery(api.users.queries.list)
  const teams = useQuery(api.teams.queries.list)
  const ownerGroups = [
    createOwnerGroup(
      "users",
      "Users",
      users?.map((user) => createOwnerOption("users", user))
    ),
    createOwnerGroup(
      "teams",
      "Teams",
      teams?.map((team) => createOwnerOption("teams", team))
    ),
  ]

  return (
    <SingleSelectorCombobox<OwnerOption, NonNullable<OwnerRef>>
      clearLabel="None"
      getValueKey={(ownerRef: NonNullable<OwnerRef>) =>
        `${ownerRef.type}:${ownerRef.id}`
      }
      objectNoun="owners"
      renderValue={(owner) => owner?.face}
      groups={ownerGroups}
      searchable
      value={value}
      onValueChange={(ownerRef) => void onChange(ownerRef)}
    />
  )
}
