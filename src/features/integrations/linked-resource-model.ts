import type { Doc } from "@/convex/_generated/dataModel"
import { DEFAULT_RESOURCE_KEYS } from "@/convex/integrations/constants"
import type { LinkedResourceType } from "@/convex/integrations/validators"

export type LinkedResource = Pick<
  Doc<"objectLinkedResources">,
  "resourceKey" | "resourceType" | "data"
>

export function findLinkedResource<TResource extends LinkedResource>(
  existing: TResource[],
  resourceType: LinkedResourceType
) {
  const resourceKey = DEFAULT_RESOURCE_KEYS[resourceType]
  return existing.find(
    (row) =>
      row.resourceType === resourceType && row.resourceKey === resourceKey
  )
}
