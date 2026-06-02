import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { findCompetitionLinkedResource } from "@/features/competition-resources/is-linked"
import {
  COMPETITION_LINK_PLUGINS,
  INTEGRATION_PLUGINS,
} from "@/plugins/integrations/registry"
import { useMutation, useQuery } from "convex/react"
import { ExternalLinkIcon, TrashIcon } from "lucide-react"

function LoadingLinkedResources() {
  return (
    <div className="flex flex-col items-start gap-2">
      {COMPETITION_LINK_PLUGINS.map((plugin) => (
        <Skeleton key={plugin.id} className="h-8 w-44" />
      ))}
    </div>
  )
}

function LinkedResourceButton({
  resource,
  onRemove,
}: {
  resource: Doc<"competitionLinkedResources">
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

export function CompetitionLinkedResourcesFooter({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const resources = useQuery(
    api.plugins.core.competitionResources.listForCompetition,
    { competitionId }
  )
  const removeResource = useMutation(
    api.plugins.core.competitionResources.removeResource
  )

  if (resources === undefined) {
    return <LoadingLinkedResources />
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {COMPETITION_LINK_PLUGINS.map((plugin) => {
        const linked = findCompetitionLinkedResource(
          resources,
          plugin.competitionLink
        )
        if (linked !== undefined) {
          return (
            <LinkedResourceButton
              key={plugin.id}
              resource={linked}
              onRemove={() => {
                void removeResource({ id: linked._id })
              }}
            />
          )
        }
        const LinkAction = plugin.LinkResourceAction
        if (LinkAction === undefined) {
          return null
        }
        return <LinkAction key={plugin.id} competitionId={competitionId} />
      })}
    </div>
  )
}
