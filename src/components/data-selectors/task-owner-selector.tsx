import { ObjectAvatar } from "@/components/object-avatar"
import { Avatar } from "@/components/ui/avatar"
import type { Doc } from "@/convex/_generated/dataModel"
import type { SelectedTaskOwner as SelectedOwner } from "@/components/data-selectors/task-selector-model"
import type { SubtaskViewOwner } from "@/convex/tasks/queries"
import { objectRefKey } from "@/lib/utils"
import { useAssignmentTeams } from "./use-assignment-teams"
import { CastleIcon } from "lucide-react"
import { useMemo, useState, type ComponentProps } from "react"
import { useUserItems } from "./user-selector-model"
import * as DataSelector from "./data-selector"
import { useSingleDataSelector } from "./data-selector-model"
import * as SelectorFace from "./selector-face"
import type { SelectorChangeHandler, SelectorGroup } from "./selector-options"

type OwnerRef = Doc<"tasks">["owner"]
type OwnerValue = NonNullable<OwnerRef>
type OwnerType = OwnerValue["type"]
type ObjectAvatarProps = Omit<ComponentProps<typeof ObjectAvatar>, "obj">
type SelectorButtonProps = ComponentProps<typeof DataSelector.ButtonTrigger>

interface TaskOwnerSelectorProps extends Pick<
  SelectorButtonProps,
  "className" | "disabled" | "size" | "variant"
> {
  avatarProps?: ObjectAvatarProps
  selectedOwner?: SelectedOwner | null
  scope?: SubtaskViewOwner
  value?: OwnerRef
  onChange: SelectorChangeHandler<OwnerRef>
}

type OwnerFaceAppearance = "property" | "name" | "icon"

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

function renderOwnerItem(owner: OwnerOption) {
  return (
    <>
      <ObjectAvatar obj={owner.owner} size="sm" />
      {owner.label}
    </>
  )
}

function EmptyOwnerFace({
  appearance,
  avatarProps,
}: {
  appearance: OwnerFaceAppearance
  avatarProps?: ObjectAvatarProps
}) {
  if (appearance === "icon") {
    return (
      <Avatar size="sm" {...avatarProps}>
        <CastleIcon
          data-slot="avatar-image"
          className="object-fit aspect-square size-full p-0.75"
        />
      </Avatar>
    )
  }

  if (appearance === "name") {
    return (
      <SelectorFace.Root>
        <SelectorFace.Text>None</SelectorFace.Text>
      </SelectorFace.Root>
    )
  }

  return <SelectorFace.Empty icon={CastleIcon}>None</SelectorFace.Empty>
}

export function Face({
  appearance,
  avatarProps,
  owner,
}: {
  appearance: OwnerFaceAppearance
  avatarProps?: ObjectAvatarProps
  owner: OwnerOption | null
}) {
  if (!owner) {
    return <EmptyOwnerFace appearance={appearance} avatarProps={avatarProps} />
  }

  if (appearance === "icon") {
    return <ObjectAvatar obj={owner.owner} size="sm" {...avatarProps} />
  }

  return (
    <SelectorFace.Root>
      {appearance === "property" && (
        <ObjectAvatar
          obj={owner.owner}
          size={avatarProps?.size ?? "sm"}
          {...avatarProps}
        />
      )}
      <SelectorFace.Text>
        {shortenOwnerName(owner.label, owner.value.type)}
      </SelectorFace.Text>
    </SelectorFace.Root>
  )
}

function OwnerSelectorControl({
  appearance,
  avatarProps,
  className,
  disabled,
  onChange,
  selectedOwner,
  scope,
  size,
  value,
  variant,
}: TaskOwnerSelectorProps & {
  appearance: OwnerFaceAppearance
}) {
  const [open, setOpen] = useState(false)
  const ownerTeams = useAssignmentTeams(open, scope)
  const fallbackItem = selectedOwner ? toOwnerOption(selectedOwner) : null
  const resolvedValue =
    value === undefined ? (fallbackItem?.value ?? null) : value
  const users = useUserItems({
    open,
    scope,
    selectedIds: resolvedValue?.type === "users" ? [resolvedValue.id] : [],
    selectedUsers: selectedOwner?.type === "users" ? [selectedOwner] : [],
  })
  const selectedItem =
    resolvedValue?.type === "users"
      ? toOwnerOption({ ...users.selectedUsers[0], type: "users" })
      : fallbackItem
  const ownerGroups = useMemo<SelectorGroup<OwnerOption, OwnerValue>[]>(
    () => [
      {
        key: "teams",
        label: "Teams",
        items: ownerTeams?.map((team) =>
          toOwnerOption({ ...team, type: "teams" })
        ),
        getLabel: (owner) => owner.label,
        getValue: (owner) => owner.value,
        renderItem: renderOwnerItem,
      },
      {
        key: "users",
        label: "Users",
        items: users.items?.map((user) =>
          toOwnerOption({ ...user, type: "users" })
        ),
        getLabel: (owner) => owner.label,
        getValue: (owner) => owner.value,
        renderItem: renderOwnerItem,
      },
    ],
    [ownerTeams, users.items]
  )
  const model = useSingleDataSelector<OwnerOption, OwnerValue>({
    getValueKey: objectRefKey,
    groups: ownerGroups,
    selectedItem,
    value: resolvedValue,
  })

  return (
    <DataSelector.SingleRoot
      model={model}
      open={open}
      searchable
      {...users.search}
      onOpenChange={setOpen}
      onValueChange={onChange}
    >
      <DataSelector.ButtonTrigger
        className={className}
        disabled={disabled}
        iconOnly={appearance === "icon"}
        size={size}
        variant={variant}
      >
        <Face
          appearance={appearance}
          avatarProps={avatarProps}
          owner={model.selectedItem}
        />
      </DataSelector.ButtonTrigger>
      <DataSelector.Content
        clearLabel="None"
        model={model}
        loading={users.loading}
        pagination={users.pagination}
        objectNoun="owners"
        searchable
      />
    </DataSelector.SingleRoot>
  )
}

export function PropertyButton(props: TaskOwnerSelectorProps) {
  return <OwnerSelectorControl appearance="property" {...props} />
}

export function NameButton({ size = "sm", ...props }: TaskOwnerSelectorProps) {
  return <OwnerSelectorControl appearance="name" size={size} {...props} />
}

export function IconButton({
  variant = "icon",
  ...props
}: TaskOwnerSelectorProps) {
  return <OwnerSelectorControl appearance="icon" variant={variant} {...props} />
}
