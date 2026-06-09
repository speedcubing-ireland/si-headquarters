import { MessageSquareIcon } from "lucide-react"
import type { IntegrationPlugin } from "@/plugins/integrations/registry"
import { LinkDiscordChannelButton } from "@/plugins/discord/link-discord-channel-button"
import { TeamDiscordChannelPicker } from "@/plugins/discord/team-discord-channel-picker"

export const discordIntegrationPlugin = {
  id: "discord",
  linkedResource: {
    resourceType: "discordChannel",
    objectTypes: ["competitions", "projects"],
  },
  adminIcon: MessageSquareIcon,
  matchesResourceType: (type) => type === "discordChannel",
  resourceIcon: () => <MessageSquareIcon className="text-violet-700" />,
  resourceLabel: (data) =>
    data.resourceType === "discordChannel" ? `#${data.channelName}` : "Discord",
  resourceHref: () => undefined,
  LinkResourceAction: LinkDiscordChannelButton,
  TeamLinkedResourceAction: TeamDiscordChannelPicker,
} satisfies IntegrationPlugin
