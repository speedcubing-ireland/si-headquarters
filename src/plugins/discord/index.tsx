import { MessageSquareIcon } from "lucide-react"
import type { IntegrationPlugin } from "@/plugins/integrations/registry"
import { LinkDiscordChannelButton } from "@/plugins/discord/link-discord-channel-button"

export const discordIntegrationPlugin = {
  id: "discord",
  competitionLink: "discordChannel",
  adminIcon: MessageSquareIcon,
  matchesResourceType: (type) => type === "discordChannel",
  resourceIcon: () => <MessageSquareIcon className="text-violet-700" />,
  resourceLabel: (data) =>
    data.resourceType === "discordChannel" ? `#${data.channelName}` : "Discord",
  resourceHref: () => undefined,
  LinkResourceAction: LinkDiscordChannelButton,
} satisfies IntegrationPlugin
