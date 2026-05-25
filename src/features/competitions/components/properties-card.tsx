import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { PhaseButton } from "@/components/data-selectors/phase-button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import {
  ExternalLinkIcon,
  FileSpreadsheetIcon,
  GavelIcon,
  GlobeIcon,
  HandCoinsIcon,
  HandshakeIcon,
  InfoIcon,
  MessageSquareIcon,
  MilestoneIcon,
  TrashIcon,
} from "lucide-react"
import {
  PageCard,
  PageCardContent,
  PageCardFooter,
  PageCardRow,
} from "../../../components/page-card"
import { Skeleton } from "@/components/ui/skeleton"

export function PropertiesCard({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const properties = useQuery(api.competitions.queries.getProperties, {
    id: competitionId,
  })
  const setCompPhase = useMutation(api.competitions.mutations.setCompPhase)

  if (properties === undefined) {
    return (
      <PageCard title="Properties" icon={<InfoIcon className="size-4" />}>
        <PageCardContent className="min-h-28">
          <PageCardRow
            icon={<MilestoneIcon className="size-4" />}
            label="Phase"
          >
            <Skeleton className="h-4 w-24" />
          </PageCardRow>
          <PageCardRow
            icon={<HandshakeIcon className="size-4" />}
            label="Sponsor"
          >
            <Skeleton className="h-4 w-32" />
          </PageCardRow>
        </PageCardContent>
        <PageCardFooter className="flex min-h-36 flex-col items-start gap-2">
          <ButtonGroup>
            <Button variant="outline" disabled>
              <GlobeIcon className="text-blue-600" />
              Loading...
            </Button>
          </ButtonGroup>
        </PageCardFooter>
      </PageCard>
    )
  }

  const { competition: comp, phase } = properties

  // To-do: Most of this is still placeholder
  return (
    <PageCard title="Properties" icon={<InfoIcon className="size-4" />}>
      <PageCardContent>
        <PageCardRow icon={<MilestoneIcon className="size-4" />} label="Phase">
          <PhaseButton
            owner={{
              type: "competitions",
              id: comp._id,
            }}
            selectedPhase={phase}
            value={comp.phaseId}
            onChange={(phaseId: Id<"phases">) =>
              setCompPhase({
                id: comp._id,
                phaseId,
              })
            }
          />
        </PageCardRow>
        <PageCardRow
          icon={<HandshakeIcon className="size-4" />}
          label="Sponsor"
        >
          <Button variant="outline">
            <GavelIcon />
            Lots O'Cubes
          </Button>
        </PageCardRow>
        <PageCardRow
          icon={<HandCoinsIcon className="size-4" />}
          label="Winning Bid"
        >
          <p>$6543.21</p>
        </PageCardRow>
      </PageCardContent>
      <PageCardFooter className="flex flex-col items-start gap-2">
        <ButtonGroup>
          <Button variant="outline">
            <GlobeIcon className="text-blue-600" />
            My Epic Cool Comp 2026
            <ExternalLinkIcon />
          </Button>
          <Button variant="outline">
            <TrashIcon className="text-destructive" />
          </Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button variant="outline">
            <FileSpreadsheetIcon className="text-lime-500" />
            My Epic Cool Comp 2026
            <ExternalLinkIcon />
          </Button>
          <Button variant="outline">
            <TrashIcon className="text-destructive" />
          </Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button variant="outline">
            <MessageSquareIcon className="text-violet-700" />
            #aug-22-cool-comp-2026
          </Button>
          <Button variant="outline">
            <TrashIcon className="text-destructive" />
          </Button>
        </ButtonGroup>
      </PageCardFooter>
    </PageCard>
  )
}
