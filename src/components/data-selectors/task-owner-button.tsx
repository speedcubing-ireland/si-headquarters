import { ObjectAvatar } from "@/components/object-avatar"
import { selectorGroup } from "@/components/data-selectors/selector-groups"
import { SingleSelectorCombobox } from "@/components/data-selectors/selector-combobox"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import { useQuery } from "convex/react"
import { useMemo } from "react"

type OwnerRef = Doc<"tasks">["owner"]
type OwnerType = NonNullable<OwnerRef>["type"]
type Team = Doc<"teams">

type OwnerByType = {
  users: PublicUser
  teams: Team
}

type OwnerOption = {
  label: string
  owner: OwnerByType[OwnerType]
  value: NonNullable<OwnerRef>
}

const getOwnerName = (owner: { name?: string }) => owner.name ?? "Unknown"
const getOwnerValueKey = (ownerRef: NonNullable<OwnerRef>) =>
  `${ownerRef.type}:${ownerRef.id}`

function shortenOwnerName(name: string, type: OwnerType) {
  if (type === "users") {
    return name.split(" ")[0]
  }

  if (type === "teams") {
    return name.replace(" Team", "")
  }

  return name
}

function OwnerDisplay({
  owner,
  valueLabel,
}: {
  owner: OwnerOption
  valueLabel: string
}) {
  return (
    <>
      <ObjectAvatar obj={owner.owner} size="sm" />
      {valueLabel}
    </>
  )
}

function TaskOwnerItem({ owner }: { owner: OwnerOption }) {
  return <OwnerDisplay owner={owner} valueLabel={owner.label} />
}

function TaskOwnerValue({ owner }: { owner: OwnerOption | null }) {
  if (!owner) return "No Owner"

  return (
    <OwnerDisplay
      owner={owner}
      valueLabel={shortenOwnerName(owner.label, owner.value.type)}
    />
  )
}

const renderOwnerItem = (owner: OwnerOption) => <TaskOwnerItem owner={owner} />
const renderOwnerValue = (owner: OwnerOption | null) => (
  <TaskOwnerValue owner={owner} />
)

function createOwnerOption<TType extends OwnerType>(
  objectType: TType,
  owner: OwnerByType[TType]
): OwnerOption {
  return {
    label: getOwnerName(owner),
    owner,
    value: { type: objectType, id: owner._id },
  }
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
  const ownerGroups = useMemo(
    () => [
      selectorGroup({
        key: "teams",
        label: "Teams",
        items: teams?.map((team) => createOwnerOption("teams", team)),
        getLabel: (owner: OwnerOption) => owner.label,
        getValue: (owner: OwnerOption) => owner.value,
        renderItem: renderOwnerItem,
      }),
      selectorGroup({
        key: "users",
        label: "Users",
        items: users?.map((user) => createOwnerOption("users", user)),
        getLabel: (owner: OwnerOption) => owner.label,
        getValue: (owner: OwnerOption) => owner.value,
        renderItem: renderOwnerItem,
      }),
    ],
    [teams, users]
  )

  return (
    <SingleSelectorCombobox<OwnerOption, NonNullable<OwnerRef>>
      clearLabel="None"
      getValueKey={getOwnerValueKey}
      objectNoun="owners"
      groups={ownerGroups}
      renderValue={renderOwnerValue}
      searchable
      value={value}
      onValueChange={(ownerRef) => void onChange(ownerRef)}
    />
  )
}
