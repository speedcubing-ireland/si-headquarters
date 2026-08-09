import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { TeamSidebarPage } from "@/convex/teams/validators"
import { useMutation, useQuery } from "convex/react"
import { Trash2Icon } from "lucide-react"
import { getTeamLinkedResourceAction } from "@/plugins/integrations/registry"
import { TEAM_SIDEBAR_PAGE_ITEMS } from "@/features/teams/sidebar-pages"
import { useState } from "react"
import { toast } from "sonner"

const TeamDiscordChannelPicker = getTeamLinkedResourceAction("discord")

export function AdminTeamsPage() {
  const rows = useQuery(api.teams.discordChannels.listAdmin, {})
  const clearChannel = useMutation(api.teams.discordChannels.clear)
  const setSidebarPageEnabled = useMutation(
    api.teams.mutations.setSidebarPageEnabled
  )
  const [savingSettings, setSavingSettings] = useState<Set<string>>(
    () => new Set()
  )

  async function updateSidebarPage(
    teamId: Id<"teams">,
    page: TeamSidebarPage,
    enabled: boolean
  ) {
    const key = `${teamId}:${page}`
    setSavingSettings((current) => new Set(current).add(key))
    try {
      await setSidebarPageEnabled({ teamId, page, enabled })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update sidebar pages."
      )
    } finally {
      setSavingSettings((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  if (rows === undefined) return null

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div
          key={row.teamId}
          className="grid gap-4 rounded-md border bg-card p-4 @lg/main:grid-cols-[minmax(10rem,1fr)_minmax(12rem,1fr)_minmax(0,2fr)]"
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
          <fieldset className="grid content-start gap-2">
            <legend className="text-xs font-medium text-muted-foreground">
              Sidebar pages
            </legend>
            {TEAM_SIDEBAR_PAGE_ITEMS.map(({ page, label }) => {
              const settingKey = `${row.teamId}:${page}`
              return (
                <label
                  key={page}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span>{label}</span>
                  <Switch
                    size="sm"
                    checked={row.sidebarPages[page]}
                    disabled={savingSettings.has(settingKey)}
                    aria-label={`${label} page enabled for ${row.teamName}`}
                    onCheckedChange={(enabled) => {
                      void updateSidebarPage(row.teamId, page, enabled)
                    }}
                  />
                </label>
              )
            })}
          </fieldset>
          <div className="grid content-start gap-2">
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
        </div>
      ))}
    </div>
  )
}
