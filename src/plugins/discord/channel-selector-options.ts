import { buildSelectorOptions } from "@/components/data-selectors/selector-options"

export interface DiscordChannelOption {
  channelId: string
  channelName: string
}

export function buildDiscordChannelSelectorOptions<
  TChannel extends DiscordChannelOption,
>(channels: TChannel[] | undefined, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  const items =
    channels?.filter((channel) =>
      normalizedQuery === ""
        ? true
        : channel.channelName.toLowerCase().includes(normalizedQuery)
    ) ?? []

  return buildSelectorOptions({
    items,
    getLabel: (channel) => `#${channel.channelName}`,
    getValue: (channel) => channel,
    getValueKey: (channel) => channel.channelId,
    renderItem: (channel) => `#${channel.channelName}`,
  })
}
