import InlineDataView from "@/components/data-views/inline-data-view"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { api } from "@/convex/_generated/api"
import { createFileRoute } from "@tanstack/react-router"
import {  useQuery } from "convex/react"
import {
  ClipboardPenIcon,
  ExternalLinkIcon,
  FileSpreadsheetIcon,
  FlagIcon,
  GavelIcon,
  GlobeIcon,
  HandCoinsIcon,
  HandshakeIcon,
  InfoIcon,
  MessageCirclePlusIcon,
  MessageSquareIcon,
  MilestoneIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"
import { Streamdown } from "streamdown"
import DemoContent from "../../../DEMO_CONTENT.md?raw"
import { DetailsCard } from "./-components/details/details-card";

export const Route = createFileRoute("/competition")({
  component: Competition,
})

function PropertiesCard() {
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

function PeopleCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          People
          <UserIcon className="size-4" />
        </CardTitle>
        <CardAction></CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex justify-between">
          <Label>
            <ClipboardPenIcon className="size-4" />
            Competition Lead
          </Label>
          <Button variant="outline">
            <Avatar size="sm">
              <AvatarImage src="https://github.com/shadcn.png" />
            </Avatar>
            Kevin
          </Button>
        </div>
        <div className="flex justify-between">
          <Label>
            <FlagIcon className="size-4" />
            Lead Delegate
          </Label>
          <Button variant="outline">
            <Avatar size="sm">
              <AvatarImage src="https://github.com/simonkellly.png" />
            </Avatar>
            Simon
          </Button>
        </div>
        <div className="flex justify-between">
          <Label>
            <UsersIcon className="size-4" />
            Organisers
          </Label>
          <Button variant="outline">
            <AvatarGroup>
              <Avatar size="sm">
                <AvatarImage
                  src="https://github.com/shadcn.png"
                  alt="@shadcn"
                />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar size="sm">
                <AvatarImage
                  src="https://github.com/maxleiter.png"
                  alt="@maxleiter"
                />
                <AvatarFallback>LR</AvatarFallback>
              </Avatar>
              <Avatar size="sm">
                <AvatarImage
                  src="https://github.com/evilrabbit.png"
                  alt="@evilrabbit"
                />
                <AvatarFallback>ER</AvatarFallback>
              </Avatar>
              <AvatarGroupCount>+3</AvatarGroupCount>
            </AvatarGroup>
          </Button>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">
          <MessageCirclePlusIcon />
          Invite Organiser To HQ
        </Button>
      </CardFooter>
    </Card>
  )
}

function UpdateCard() {
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 pt-2">
          <Avatar size="sm">
            <AvatarImage src="https://github.com/simonkellly.png" />
          </Avatar>
          Simon Kelly
          <Badge variant="secondary">12/3/2026</Badge>
        </CardTitle>
        <CardAction>
          <Button variant="outline" size="icon">
            <PencilIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent divided className="border-t">
        <Streamdown className="pt-2">{DemoContent}</Streamdown>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button size="sm" variant="outline">
          👍 3
        </Button>
        <Button size="sm" variant="outline">
          ❤️ 7
        </Button>
        <Button size="sm" variant="outline">
          😢 2
        </Button>
        <Button size="sm" variant="outline">
          😮 1
        </Button>
        <Button size="sm" variant="outline">
          😡 1
        </Button>
        <Button size="sm" variant="outline">
          +
        </Button>
      </CardFooter>
    </Card>
  )
}


function Competition() {
  const comp = useQuery(api.competitions.queries.getFakeComp)

  if (!comp) return <></>

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
      <DetailsCard comp={comp} />
      <PropertiesCard />
      <PeopleCard />
      <UpdateCard />
      <InlineDataView />
      <div className="h-96" />
    </div>
  )
}
