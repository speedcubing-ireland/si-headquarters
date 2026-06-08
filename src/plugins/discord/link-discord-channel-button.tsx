import { api } from "@/convex/_generated/api"
import type { FunctionReturnType } from "convex/server"
import {
  LinkResourcePicker,
  useLinkAction,
  useOpenLoad,
} from "@/features/integrations"
import type { LinkResourceActionProps } from "@/plugins/integrations/registry"
import { useAction } from "convex/react"
import { MessageSquareIcon } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { buildDiscordChannelSelectorOptions } from "@/plugins/discord/channel-selector-options"

type DiscordChannel = FunctionReturnType<
  typeof api.plugins.discord.channels.listChannels
>[number]

export function LinkDiscordChannelButton({
  competitionId,
}: LinkResourceActionProps) {
  const { open, setOpen, close, error, setError, pending, run } =
    useLinkAction()
  const [query, setQuery] = useState("")
  const listChannels = useAction(api.plugins.discord.channels.listChannels)
  const linkChannel = useAction(api.plugins.discord.resources.linkChannel)

  const loadChannels = useCallback(
    () => listChannels({ competitionId }),
    [competitionId, listChannels]
  )

  const { data: channels, reset: resetChannels } = useOpenLoad({
    open,
    load: loadChannels,
    onError: setError,
  })

  const model = useMemo(
    () => buildDiscordChannelSelectorOptions(channels, query),
    [channels, query]
  )

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
      loading={channels === undefined}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setQuery("")
          resetChannels()
          setError(null)
        }
      }}
      onPick={async (channel) => {
        const linked = await run(async () => {
          await linkChannel({
            competitionId,
            channelId: channel.channelId,
          })
        })
        if (linked) {
          close()
          setQuery("")
          resetChannels()
        }
      }}
    />
  )
}
