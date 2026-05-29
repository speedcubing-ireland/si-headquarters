import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CommandItem } from "@/components/ui/command"
import { cn } from "@/lib/utils"

function avatarInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}
import type { LucideIcon } from "lucide-react"
import { CheckIcon } from "lucide-react"

export type FilterOption = {
  value: string
  label: string
  icon?: LucideIcon | null
  avatar?: { name: string; image: string | null } | null
  color?: string
}

export function FilterOptionRow({
  option,
  isSelected,
  onSelect,
}: {
  option: FilterOption
  isSelected: boolean
  onSelect: () => void
}) {
  const Icon = option.icon

  return (
    <CommandItem
      value={option.value}
      onSelect={onSelect}
      className="flex items-center justify-between"
    >
      <div className="flex min-w-0 items-center gap-2">
        {option.avatar ? (
          <Avatar className="size-6">
            {option.avatar.image ? (
              <AvatarImage src={option.avatar.image} alt="" />
            ) : null}
            <AvatarFallback className="text-[10px]">
              {avatarInitials(option.avatar.name)}
            </AvatarFallback>
          </Avatar>
        ) : Icon ? (
          <Icon className="size-4 text-muted-foreground" />
        ) : option.color ? (
          <div
            className="size-3 rounded-full"
            style={{ backgroundColor: option.color }}
          />
        ) : null}
        <span className="truncate text-xs">{option.label}</span>
      </div>
      <CheckIcon
        className={cn(
          "size-4 text-muted-foreground",
          !isSelected && "opacity-0"
        )}
      />
    </CommandItem>
  )
}
