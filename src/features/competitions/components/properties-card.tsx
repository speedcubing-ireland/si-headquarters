import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
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

// Concept
// Pre-Announcement bg-red-500
// Announced bg-sky-500
// Pre-Competition bg-amber-400
// Post-Competition bg-green-600
// Completed bg-gray-400 dark:bg-gray-600

export function PropertiesCard() {
  return (
    <CompetitionCard title="Properties" icon={<InfoIcon className="size-4" />}>
      <CompetitionCardContent>
        <CompetitionCardRow
          icon={<MilestoneIcon className="size-4" />}
          label="Phase"
        >
          <Button variant="outline">
            <span
              className="size-3 rounded-full bg-gray-400 dark:bg-gray-600"
              aria-hidden="true"
            />
            Pre-Announcement
          </Button>
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
