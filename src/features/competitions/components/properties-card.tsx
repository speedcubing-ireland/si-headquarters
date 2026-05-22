import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
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

export function PropertiesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Properties
          <InfoIcon className="size-4" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex justify-between">
          <Label>
            <MilestoneIcon className="size-4" />
            Phase
          </Label>
          <Button variant="outline">
            <span
              className="size-3 rounded-full bg-red-500"
              aria-hidden="true"
            />
            Pre-Announcement
          </Button>
        </div>
        <div className="flex justify-between">
          <Label>
            <HandshakeIcon className="size-4" />
            Sponsor
          </Label>
          <Button variant="outline">
            <GavelIcon />
            Lots O'Cubes
          </Button>
        </div>
        <div className="flex justify-between">
          <Label>
            <HandCoinsIcon className="size-4" />
            Winning Bid
          </Label>
          <p>$6543.21</p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-2">
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
      </CardFooter>
    </Card>
  )
}
