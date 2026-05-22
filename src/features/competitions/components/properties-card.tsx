import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { PhaseButton } from "@/components/data-selectors/phase-button"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { useMutation } from "convex/react"
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
  CompetitionCard,
  CompetitionCardContent,
  CompetitionCardFooter,
  CompetitionCardRow,
} from "./competition-card"

export function PropertiesCard({ comp }: { comp: Doc<"competitions"> }) {
  const setCompPhase = useMutation(api.competitions.mutations.setCompPhase)

  // To-do: Most of this is still placeholder
  return (
    <CompetitionCard title="Properties" icon={<InfoIcon className="size-4" />}>
      <CompetitionCardContent>
        <CompetitionCardRow
          icon={<MilestoneIcon className="size-4" />}
          label="Phase"
        >
          <PhaseButton
            owner={{
              type: "competitions",
              id: comp._id,
            }}
            value={comp.phaseId}
            onChange={(phaseId: Id<"phases">) =>
              setCompPhase({
                id: comp._id,
                phaseId,
              })
            }
          />
        </CompetitionCardRow>
        <CompetitionCardRow
          icon={<HandshakeIcon className="size-4" />}
          label="Sponsor"
        >
          <Button variant="outline">
            <GavelIcon />
            Lots O'Cubes
          </Button>
        </CompetitionCardRow>
        <CompetitionCardRow
          icon={<HandCoinsIcon className="size-4" />}
          label="Winning Bid"
        >
          <p>$6543.21</p>
        </CompetitionCardRow>
      </CompetitionCardContent>
      <CompetitionCardFooter className="flex flex-col items-start gap-2">
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
      </CompetitionCardFooter>
    </CompetitionCard>
  )
}
