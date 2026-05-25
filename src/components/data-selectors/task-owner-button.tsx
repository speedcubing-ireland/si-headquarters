import { ObjectAvatar } from "@/components/object-avatar"
import { Button } from "@/components/ui/button"
import { selectorGroup } from "@/components/data-selectors/selector-groups"
import { SingleSelectorCombobox } from "@/components/data-selectors/selector-combobox"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import { useQuery } from "convex/react"
import { useMemo, useState } from "react"

type OwnerRef = Doc<"tasks">["owner"]
type OwnerType = NonNullable<OwnerRef>["type"]
type Team = Pick<Doc<"teams">, "_id" | "name">

type OwnerByType = {
  users: PublicUser
  teams: Team
}

type OwnerOption = {
  label: string
  owner: OwnerByType[OwnerType]
  value: NonNullable<OwnerRef>
}

type TaskOwnerButtonProps = {
  selectedOwner?: OwnerOption | null
  showAvatar?: boolean
  size?: React.ComponentProps<typeof Button>["size"]
  value: OwnerRef
  variant?: React.ComponentProps<typeof Button>["variant"]
  onChange: (value: OwnerRef) => void | Promise<void> | Promise<null>
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

function OwnerValue({
  owner,
  showAvatar,
}: {
  owner: OwnerOption | null
  showAvatar: boolean
}) {
  if (!owner) return "No Owner"

  const label = shortenOwnerName(owner.label, owner.value.type)
  if (!showAvatar) return label

  return (
    <>
      <ObjectAvatar obj={owner.owner} size="sm" />
      {label}
    </>
  )
}

const renderOwnerItem = (owner: OwnerOption) => (
  <>
    <ObjectAvatar obj={owner.owner} size="sm" />
    {owner.label}
  </>
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
  selectedOwner,
  showAvatar = true,
  size,
  value,
  variant,
  onChange,
}: TaskOwnerButtonProps) {
  const [open, setOpen] = useState(false)
  const users = useQuery(api.users.queries.list, open ? {} : "skip")
  const teams = useQuery(api.teams.queries.list, open ? {} : "skip")
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
      open={open}
      renderValue={(owner) => (
        <OwnerValue owner={owner} showAvatar={showAvatar} />
      )}
      searchable
      selectedItem={selectedOwner}
      size={size}
      value={value}
      variant={variant}
      onOpenChange={setOpen}
      onValueChange={(ownerRef) => void onChange(ownerRef)}
    />
  )
}
