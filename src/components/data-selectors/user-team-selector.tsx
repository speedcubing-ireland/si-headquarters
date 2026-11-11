import { ObjectAvatar } from "@/components/object-avatar"
import { Avatar, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import { objectRefKey } from "@/lib/utils"
import { useAssignmentTeams } from "./use-assignment-teams"
import { UsersRoundIcon } from "lucide-react"
import { useMemo, useState, type ComponentProps } from "react"
import { useUserItems } from "./user-selector-model"
import * as DataSelector from "./data-selector"
import { useMultipleDataSelector } from "./data-selector-model"
import * as SelectorFace from "./selector-face"
import type { SelectorChangeHandler, SelectorGroup } from "./selector-options"

type Team = Pick<Doc<"teams">, "_id" | "name">
type ProjectMemberRef = Doc<"projectMembers">["member"]
type SelectedMember =
  | (PublicUser & { type: "users" })
  | (Team & { type: "teams" })
type ObjectAvatarProps = Omit<ComponentProps<typeof ObjectAvatar>, "obj">
type SelectorButtonProps = ComponentProps<typeof DataSelector.ButtonTrigger>

interface MultiUserTeamSelectorProps extends Pick<
  SelectorButtonProps,
  "className" | "disabled" | "size" | "variant"
> {
  avatarProps?: ObjectAvatarProps
  maxAvatars?: number
  projectId?: Id<"projects">
  selectedMembers?: SelectedMember[]
  value: ProjectMemberRef[]
  onChange: SelectorChangeHandler<ProjectMemberRef[]>
}

function memberLabel(member: SelectedMember) {
  return member.name ?? "Unknown user"
}

function toOption(member: SelectedMember) {
  const value: ProjectMemberRef =
    member.type === "users"
      ? { type: "users", id: member._id }
      : { type: "teams", id: member._id }

  return {
    label: memberLabel(member),
    member,
    value,
  }
}

type MemberOption = ReturnType<typeof toOption>

function renderMemberItem(option: MemberOption) {
  return (
    <>
      <ObjectAvatar obj={option.member} size="sm" />
      <span className="truncate">{option.label}</span>
    </>
  )
}

function visibleAvatarCount(memberCount: number, maxAvatars?: number) {
  if (maxAvatars === undefined) return Math.min(memberCount, 3)
  const slotCount = Math.max(1, Math.floor(maxAvatars))
  return memberCount <= slotCount ? memberCount : slotCount - 1
}

function EmptyFace({ avatarProps }: { avatarProps?: ObjectAvatarProps }) {
  return (
    <SelectorFace.Root>
      <Avatar size="sm" {...avatarProps}>
        <UsersRoundIcon
          data-slot="avatar-image"
          className="object-fit aspect-square size-full p-0.75"
        />
      </Avatar>
      <SelectorFace.Text>None</SelectorFace.Text>
    </SelectorFace.Root>
  )
}

function Face({
  avatarProps,
  maxAvatars,
  members,
}: {
  avatarProps?: ObjectAvatarProps
  maxAvatars?: number
  members: SelectedMember[]
}) {
  if (members.length === 0) {
    return <EmptyFace avatarProps={avatarProps} />
  }

  if (members.length === 1) {
    return (
      <SelectorFace.Root>
        <ObjectAvatar obj={members[0]} size="sm" {...avatarProps} />
        <SelectorFace.Text>{memberLabel(members[0])}</SelectorFace.Text>
      </SelectorFace.Root>
    )
  }

  const shown = visibleAvatarCount(members.length, maxAvatars)
  const hidden = members.length - shown

  return (
    <SelectorFace.Root>
      <AvatarGroup>
        {members.slice(0, shown).map((member) => (
          <ObjectAvatar
            key={member._id}
            obj={member}
            size="sm"
            {...avatarProps}
          />
        ))}
        {hidden > 0 ? (
          <AvatarGroupCount className={avatarProps?.className}>
            +{hidden}
          </AvatarGroupCount>
        ) : null}
      </AvatarGroup>
    </SelectorFace.Root>
  )
}

export function MultiPropertyButton({
  avatarProps,
  className,
  disabled,
  maxAvatars,
  onChange,
  projectId,
  selectedMembers = [],
  size,
  value,
  variant,
}: MultiUserTeamSelectorProps) {
  const [open, setOpen] = useState(false)
  const scope =
    projectId === undefined
      ? undefined
      : { type: "projects" as const, id: projectId }
  const teams = useAssignmentTeams(open, scope)
  const users = useUserItems({
    open,
    scope,
    selectedIds: value.flatMap((ref) => (ref.type === "users" ? [ref.id] : [])),
    selectedUsers: selectedMembers.filter(
      (member): member is PublicUser & { type: "users" } =>
        member.type === "users"
    ),
  })
  const groups = useMemo<SelectorGroup<MemberOption, ProjectMemberRef>[]>(
    () => [
      {
        key: "teams",
        label: "Teams",
        items: teams?.map((team) => toOption({ ...team, type: "teams" })),
        getLabel: (option) => option.label,
        getValue: (option) => option.value,
        renderItem: renderMemberItem,
      },
      {
        key: "users",
        label: "Users",
        items: users.items?.map((user) => toOption({ ...user, type: "users" })),
        getLabel: (option) => option.label,
        getValue: (option) => option.value,
        renderItem: renderMemberItem,
      },
    ],
    [teams, users.items]
  )
  const model = useMultipleDataSelector<MemberOption, ProjectMemberRef>({
    getValueKey: objectRefKey,
    groups,
    selectedItems: [
      ...selectedMembers.filter((member) => member.type === "teams"),
      ...users.selectedUsers.map((user) => ({
        ...user,
        type: "users" as const,
      })),
    ].map(toOption),
    values: value,
  })

  return (
    <DataSelector.MultipleRoot
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
        size={size}
        variant={variant}
      >
        <Face
          avatarProps={avatarProps}
          maxAvatars={maxAvatars}
          members={model.selectedItems.map((option) => option.member)}
        />
      </DataSelector.ButtonTrigger>
      <DataSelector.Content
        model={model}
        loading={users.loading}
        pagination={users.pagination}
        objectNoun="members"
        searchable
      />
    </DataSelector.MultipleRoot>
  )
}
