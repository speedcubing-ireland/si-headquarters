import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { useMutation, useQuery } from "convex/react"
import { Trash2Icon } from "lucide-react"
import { getTeamLinkedResourceAction } from "@/plugins/integrations/registry"

const TeamDiscordChannelPicker = getTeamLinkedResourceAction("discord")

export function AdminTeamsPage() {
  const rows = useQuery(api.teams.discordChannels.listAdmin, {})
  const clearChannel = useMutation(api.teams.discordChannels.clear)

  if (rows === undefined) return null

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div
          key={row.teamId}
          className="grid gap-3 rounded-md border bg-card p-4 @lg/main:grid-cols-[minmax(10rem,1fr)_minmax(0,2fr)_auto]"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{row.teamName}</div>
            <div className="truncate text-xs text-muted-foreground">
              {row.memberCount === 1
                ? "1 member"
                : `${String(row.memberCount)} members`}
              {" · "}
              {row.channel === null
                ? "No Discord channel"
                : `#${row.channel.channelName}`}
            </div>
          </div>
          {TeamDiscordChannelPicker === undefined ? null : (
            <TeamDiscordChannelPicker
              teamId={row.teamId}
              linkedChannelName={row.channel?.channelName ?? null}
            />
          )}
          <div className="flex gap-2 @lg/main:justify-end">
            <Button
              variant="ghost"
              disabled={row.channel === null}
              onClick={() => void clearChannel({ teamId: row.teamId })}
            >
              <Trash2Icon />
              Clear
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
