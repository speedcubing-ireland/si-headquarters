import { api } from "@/convex/_generated/api"
import type { FunctionReturnType } from "convex/server"
import {
  LinkResourcePicker,
  useLinkAction,
  useLinkResourcePicker,
} from "@/features/integrations"
import type { LinkResourceActionProps } from "@/plugins/integrations/registry"
import { useAction } from "convex/react"
import { MessageSquareIcon } from "lucide-react"
import { useCallback } from "react"
import { buildDiscordChannelSelectorOptions } from "@/plugins/discord/channel-selector-options"

type DiscordChannel = FunctionReturnType<
  typeof api.plugins.discord.channels.listChannelsForObject
>[number]

export function LinkDiscordChannelButton({ object }: LinkResourceActionProps) {
  const { open, setOpen, close, error, setError, pending, run } =
    useLinkAction()
  const listChannels = useAction(
    api.plugins.discord.channels.listChannelsForObject
  )
  const linkChannel = useAction(api.plugins.discord.resources.linkChannel)

  const loadChannels = useCallback(() => {
    return listChannels({ object })
  }, [listChannels, object])

  const { query, setQuery, model, loading, resetPicker, handleOpenChange } =
    useLinkResourcePicker({
      open,
      load: loadChannels,
      onError: setError,
      buildModel: buildDiscordChannelSelectorOptions,
    })

  return (
    <LinkResourcePicker<DiscordChannel, DiscordChannel>
      triggerIcon={MessageSquareIcon}
      triggerIconClassName="text-violet-700"
      triggerLabel="Link Discord channel"
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
          await linkChannel({
            object,
            channelId: channel.channelId,
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
