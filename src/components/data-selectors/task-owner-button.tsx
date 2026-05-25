import { ObjectAvatar } from "@/components/object-avatar"
import type { Button } from "@/components/ui/button"
import { selectorGroup } from "@/components/data-selectors/selector-groups"
import { SingleSelectorCombobox } from "@/components/data-selectors/selector-combobox"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import { useQuery } from "convex/react"
import { useMemo, useState } from "react"

type OwnerRef = Doc<"tasks">["owner"]
type OwnerValue = NonNullable<OwnerRef>
type OwnerType = OwnerValue["type"]
type Team = Pick<Doc<"teams">, "_id" | "name">
type SelectedOwner =
  | (PublicUser & { type: "users" })
  | (Team & { type: "teams" })

interface TaskOwnerButtonProps {
  selectedOwner?: SelectedOwner | null
  showAvatar?: boolean
  size?: React.ComponentProps<typeof Button>["size"]
  value?: OwnerRef
  variant?: React.ComponentProps<typeof Button>["variant"]
  onChange: (value: OwnerRef) => Promise<null> | undefined
}

const getOwnerValueKey = (ownerRef: OwnerValue) =>
  `${ownerRef.type}:${ownerRef.id}`

function toOwnerOption(owner: SelectedOwner) {
  if (owner.type === "users") {
    return {
      label: owner.name ?? "Unknown",
      owner,
      value: { type: owner.type, id: owner._id },
    }
  }

  return {
    label: owner.name,
    owner,
    value: { type: owner.type, id: owner._id },
  }
}

type OwnerOption = ReturnType<typeof toOwnerOption>

function shortenOwnerName(name: string, type: OwnerType) {
  if (type === "users") {
    return name.split(" ")[0]
  }

  return name.replace(" Team", "")
}

function OwnerButtonFace({
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
  const selectedItem = selectedOwner ? toOwnerOption(selectedOwner) : null
  const ownerGroups = useMemo(
    () => [
      selectorGroup({
        key: "teams",
        label: "Teams",
        items: teams?.map((team) => toOwnerOption({ ...team, type: "teams" })),
        getLabel: (owner) => owner.label,
        getValue: (owner) => owner.value,
        renderItem: renderOwnerItem,
      }),
      selectorGroup({
        key: "users",
        label: "Users",
        items: users?.map((user) => toOwnerOption({ ...user, type: "users" })),
        getLabel: (owner) => owner.label,
        getValue: (owner) => owner.value,
        renderItem: renderOwnerItem,
      }),
    ],
    [teams, users]
  )

  return (
    <SingleSelectorCombobox<OwnerOption, OwnerValue>
      clearLabel="None"
      getValueKey={getOwnerValueKey}
      objectNoun="owners"
      groups={ownerGroups}
      open={open}
      renderValue={(owner) => (
        <OwnerButtonFace owner={owner} showAvatar={showAvatar} />
      )}
      searchable
      selectedItem={selectedItem}
      size={size}
      value={value ?? selectedItem?.value ?? null}
      variant={variant}
      onOpenChange={setOpen}
      onValueChange={(ownerRef) => void onChange(ownerRef)}
    />
  )
}
