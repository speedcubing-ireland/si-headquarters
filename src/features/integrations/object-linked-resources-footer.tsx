import { api } from "@/convex/_generated/api"
import type { CompetitionOrProjectRef } from "@/convex/utils"
import { LinkedResourcesFooter } from "@/features/integrations/linked-resources-footer"
import { getLinkedResourcePlugins } from "@/plugins/integrations/registry"
import { useMutation, useQuery } from "convex/react"

export function ObjectLinkedResourcesFooter({
  object,
}: {
  object: CompetitionOrProjectRef
}) {
  const resources = useQuery(api.integrations.objectResources.listForObject, {
    object,
  })
  const removeResource = useMutation(
    api.integrations.objectResources.removeResource
  )
  const plugins = getLinkedResourcePlugins(object.type)

  return (
    <LinkedResourcesFooter
      object={object}
      resources={resources}
      plugins={plugins.map((plugin) => ({
        id: plugin.id,
        resourceType: plugin.linkedResource.resourceType,
        LinkAction: plugin.LinkResourceAction,
      }))}
      onRemove={(resource) => {
        void removeResource({ id: resource._id })
      }}
    />
  )
}
