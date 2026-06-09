import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Skeleton } from "@/components/ui/skeleton"
import type { PluginId } from "@/convex/integrations/constants"
import type { LinkedResource } from "@/features/integrations/linked-resource-model"
import { INTEGRATION_PLUGINS } from "@/plugins/integrations/registry"
import { ExternalLinkIcon, TrashIcon } from "lucide-react"

export function LinkedResourceSkeletons({
  pluginIds,
}: {
  pluginIds: PluginId[]
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      {pluginIds.map((pluginId) => (
        <Skeleton key={pluginId} className="h-8 w-44" />
      ))}
    </div>
  )
}

export function LinkedResourceButton({
  resource,
  onRemove,
}: {
  resource: LinkedResource
  onRemove: () => void
}) {
  const plugin = INTEGRATION_PLUGINS.find((p) =>
    p.matchesResourceType(resource.data.resourceType)
  )
  const icon = plugin?.resourceIcon(resource.data) ?? null
  const label = plugin?.resourceLabel(resource.data) ?? resource.resourceKey
  const href = plugin?.resourceHref(resource.data)

  return (
    <ButtonGroup>
      {href !== undefined ? (
        <Button variant="outline" asChild>
          <a href={href} target="_blank" rel="noreferrer">
            {icon}
            {label}
            <ExternalLinkIcon />
          </a>
        </Button>
      ) : (
        <Button variant="outline" type="button">
          {icon}
          {label}
        </Button>
      )}
      <Button variant="outline" type="button" onClick={onRemove}>
        <TrashIcon className="text-destructive" />
      </Button>
    </ButtonGroup>
  )
}
