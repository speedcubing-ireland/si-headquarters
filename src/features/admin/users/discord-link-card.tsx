import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { resolveDiscordAvatarUrl } from "@/convex/users/avatar"
import type { AdminDiscordUpdate, DiscordLink } from "@/convex/users/validators"
import { DiscordMemberSearch } from "@/features/admin/users/discord-member-search"
import type { AdminUser } from "@/features/admin/users/utils"

function resolveDiscordDisplay(
  user: AdminUser,
  discord: AdminDiscordUpdate
): {
  displayName: string
  username?: string
  avatarUrl: string
} | null {
  if (discord.kind === "unlink") {
    return null
  }
  if (discord.kind === "link") {
    return {
      displayName: discord.member.discordDisplayName,
      username: discord.member.discordUsername,
      avatarUrl:
        resolveDiscordAvatarUrl(
          discord.member.discordUserId,
          discord.member.discordAvatarHash
        ) ?? "",
    }
  }
  if (user.discordUserId === undefined) {
    return null
  }
  return {
    displayName: user.discordDisplayName ?? user.discordUsername ?? "Discord",
    username: user.discordUsername,
    avatarUrl:
      resolveDiscordAvatarUrl(user.discordUserId, user.discordAvatarHash) ?? "",
  }
}

export function DiscordLinkSection({
  user,
  discord,
  linkedDiscordByUserId,
  onDiscordChange,
}: {
  user: AdminUser
  discord: AdminDiscordUpdate
  linkedDiscordByUserId: Map<
    string,
    { userId: AdminUser["_id"]; label: string }
  >
  onDiscordChange: (discord: AdminDiscordUpdate) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const display = resolveDiscordDisplay(user, discord)
  const pendingLink = discord.kind === "link"

  if (display !== null) {
    const initials = display.displayName.slice(0, 2).toUpperCase()
    return (
      <Item variant="outline" className="w-full">
        <ItemMedia variant="image" className="size-12 rounded-full">
          <Avatar className="size-12">
            <AvatarImage src={display.avatarUrl} alt={display.displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{display.displayName}</ItemTitle>
          {display.username !== undefined ? (
            <ItemDescription>@{display.username}</ItemDescription>
          ) : null}
          {pendingLink ? (
            <ItemDescription>Save to apply this link.</ItemDescription>
          ) : null}
          <ItemActions className="pt-2">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  Change
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <DiscordMemberSearch
                  linkedDiscordByUserId={linkedDiscordByUserId}
                  currentUserId={user._id}
                  onSelect={(member: DiscordLink) => {
                    onDiscordChange({ kind: "link", member })
                    setPickerOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
            {discord.kind !== "unlink" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onDiscordChange({ kind: "unlink" })
                }}
              >
                Unlink
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onDiscordChange({ kind: "unchanged" })
                }}
              >
                Undo
              </Button>
            )}
          </ItemActions>
        </ItemContent>
      </Item>
    )
  }

  return (
    <div className="space-y-2">
      <ItemDescription>Not linked to a guild member.</ItemDescription>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Link account
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <DiscordMemberSearch
            linkedDiscordByUserId={linkedDiscordByUserId}
            currentUserId={user._id}
            onSelect={(member: DiscordLink) => {
              onDiscordChange({ kind: "link", member })
              setPickerOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
