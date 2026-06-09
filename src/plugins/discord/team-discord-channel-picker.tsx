import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { FunctionReturnType } from "convex/server"
import {
  LinkResourcePicker,
  useLinkAction,
  useLinkResourcePicker,
} from "@/features/integrations"
import { useAction, useMutation } from "convex/react"
import { MessageSquareIcon } from "lucide-react"
import { useCallback } from "react"
import { buildDiscordChannelSelectorOptions } from "@/plugins/discord/channel-selector-options"

type DiscordChannel = FunctionReturnType<
  typeof api.plugins.discord.channels.listGuildChannelsForAdmin
>[number]

export function TeamDiscordChannelPicker({
  teamId,
  linkedChannelName,
}: {
  teamId: Id<"teams">
  linkedChannelName: string | null
}) {
  const { open, setOpen, close, error, setError, pending, run } =
    useLinkAction()
  const listChannels = useAction(
    api.plugins.discord.channels.listGuildChannelsForAdmin
  )
  const setChannel = useMutation(api.teams.discordChannels.set)

  const loadChannels = useCallback(() => listChannels({}), [listChannels])

  const { query, setQuery, model, loading, resetPicker, handleOpenChange } =
    useLinkResourcePicker({
      open,
      load: loadChannels,
      onError: setError,
      buildModel: buildDiscordChannelSelectorOptions,
    })

  const triggerLabel =
    linkedChannelName === null
      ? "Link Discord channel"
      : `Change #${linkedChannelName}`

  return (
    <LinkResourcePicker<DiscordChannel, DiscordChannel>
      triggerIcon={MessageSquareIcon}
      triggerIconClassName="text-violet-700"
      triggerLabel={triggerLabel}
      objectNoun="channels"
      model={model}
      open={open}
      pending={pending}
      error={error}
      searchable
      searchQuery={query}
      onSearchChange={setQuery}
      loading={loading}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        handleOpenChange(nextOpen)
      }}
      onPick={async (channel) => {
        const linked = await run(async () => {
          await setChannel({
            teamId,
            channelId: channel.channelId,
            channelName: channel.channelName,
          })
        })
        if (linked) {
          close()
          resetPicker()
        }
      }}
    />
  )
}
