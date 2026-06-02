import type { Doc } from "@/convex/_generated/dataModel"
import {
  DEFAULT_RESOURCE_KEYS,
  type CompetitionResourceType,
} from "@/convex/plugins/core/types"

export function findCompetitionLinkedResource(
  existing: Doc<"competitionLinkedResources">[],
  resourceType: CompetitionResourceType
) {
  const resourceKey = DEFAULT_RESOURCE_KEYS[resourceType]
  return existing.find(
    (row) =>
      row.resourceType === resourceType && row.resourceKey === resourceKey
  )
}
