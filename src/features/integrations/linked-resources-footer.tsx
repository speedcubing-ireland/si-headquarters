import {
  LinkedResourceButton,
  LinkedResourceSkeletons,
} from "@/features/integrations/linked-resource-actions"
import {
  findLinkedResource,
  type LinkedResource,
} from "@/features/integrations/linked-resource-model"
import type { PluginId } from "@/convex/integrations/constants"
import type { LinkedResourceType } from "@/convex/integrations/validators"
import type { CompetitionOrProjectRef } from "@/convex/utils"
import type { ComponentType } from "react"

export interface LinkedResourcePluginAction {
  id: PluginId
  resourceType: LinkedResourceType
  LinkAction?: ComponentType<{ object: CompetitionOrProjectRef }>
}

export function LinkedResourcesFooter<
  TResource extends LinkedResource & { _id: string },
>({
  object,
  plugins,
  resources,
  onRemove,
}: {
  object: CompetitionOrProjectRef
  plugins: LinkedResourcePluginAction[]
  resources: TResource[] | undefined
  onRemove: (resource: TResource) => void
}) {
  if (resources === undefined) {
    return (
      <LinkedResourceSkeletons pluginIds={plugins.map((plugin) => plugin.id)} />
    )
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {plugins.map((plugin) => {
        const linked = findLinkedResource(resources, plugin.resourceType)
        if (linked !== undefined) {
          return (
            <LinkedResourceButton
              key={plugin.id}
              resource={linked}
              onRemove={() => {
                onRemove(linked)
              }}
            />
          )
        }

        const LinkAction = plugin.LinkAction
        return LinkAction === undefined ? null : (
          <LinkAction key={plugin.id} object={object} />
        )
      })}
    </div>
  )
}
