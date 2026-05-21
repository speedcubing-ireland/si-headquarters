import { DatePickerWithRange } from '@/components/data-selectors/date-range-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { createFileRoute } from '@tanstack/react-router'
import { BellIcon, ClipboardPenIcon, ExternalLinkIcon, FileSpreadsheetIcon, FlagIcon, GavelIcon, GlobeIcon, HandCoinsIcon, HandshakeIcon, InfoIcon, MessageCirclePlusIcon, MessageSquareIcon, MilestoneIcon, PencilIcon, TrashIcon, UserIcon, UsersIcon } from 'lucide-react';
import { Streamdown } from "streamdown";
import DemoContent from "../../DEMO_CONTENT.md?raw";
import { Label } from '@/components/ui/label';
import { ButtonGroup } from '@/components/ui/button-group';
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from '@/components/ui/avatar';
import InlineDataView from '@/components/data-views/inline-data-view';
import { useQuery } from 'convex/react';
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";

export const Route = createFileRoute('/competition')({
  component: Competition,
})

const DEMO_DETAILS = {
  name: "My Cool Task",
  description: "This is an example task used for development",
  phase: "Pre-Launch",
  progress: {
    phaseTaskCount: 15,
    done: 7,
    inProgress: 3,
    blocked: 1,
    completionPercent: Math.round(100 * 7 / 15),
  }
}

function ProgressSegment({
  className,
  count,
  total,
}: {
  className: string;
  count: number;
  total: number;
}) {
  if (count <= 0 || total <= 0) return null;

  return (
    <div
      className={cn("h-full shrink-0", className)}
      style={{ width: `${(count / total) * 100}%` }}
    />
  );
}

function ProgressTracker() {  
  const { progress } = DEMO_DETAILS;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs mb-2">
        <Badge variant="outline">Pre-Announcement</Badge>
  			<span className="font-medium">
  				{progress.completionPercent}% complete
  			</span>
  		</div>
      <div
        aria-label={`${progress.done} done, ${progress.inProgress} in progress, ${progress.blocked} blocked out of ${progress.phaseTaskCount} total`}
        aria-valuemax={progress.phaseTaskCount}
        aria-valuemin={0}
        aria-valuenow={progress.done + progress.inProgress + progress.blocked}
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <ProgressSegment
          className="bg-primary"
          count={progress.done}
          total={progress.phaseTaskCount}
        />
        <ProgressSegment
          className="bg-yellow-500"
          count={progress.inProgress}
          total={progress.phaseTaskCount}
        />
        <ProgressSegment
          className="bg-destructive"
          count={progress.blocked}
          total={progress.phaseTaskCount}
        />
      </div>
  		<div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
  			<span>
  				<span className="text-foreground font-medium">{progress.done}</span>{" "}
  				done
  			</span>
  			<span>
  				<span className="text-foreground font-medium">
  					{progress.inProgress}
  				</span>{" "}
  				in progress
  			</span>
  			<span>
  				<span className="text-foreground font-medium">{progress.phaseTaskCount}</span>{" "}
  				total
  			</span>
  			{progress.blocked > 0 && (
  				<span className="text-destructive">
  					<span className="font-medium">{progress.blocked}</span> blocked
  				</span>
  			)}
      </div>
    </div>
  );
}

function PropertiesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Properties
          <InfoIcon className="size-4"/>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex justify-between">
          <Label>
            <MilestoneIcon className="size-4" />
            Phase
          </Label>
          <Button variant="outline">
            <span className='bg-red-500 size-3 rounded-full' aria-hidden='true' />
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
      <CardFooter className="flex flex-col gap-2 items-start">
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
  );
}

function PeopleCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          People
          <UserIcon className="size-4"/>
        </CardTitle>
        <CardAction>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 flex-1">
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
          <Button variant="outline" >
            <AvatarGroup>
              <Avatar size="sm">
                <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar size="sm">
                <AvatarImage src="https://github.com/maxleiter.png" alt="@maxleiter" />
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
  );
}

function UpdateCard() {
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="pt-2 flex items-center gap-2">
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
        <Button size="sm" variant="outline">👍 3</Button>
        <Button size="sm" variant="outline">❤️ 7</Button>
        <Button size="sm" variant="outline">😢 2</Button>
        <Button size="sm" variant="outline">😮 1</Button>
        <Button size="sm" variant="outline">😡 1</Button>
        <Button size="sm" variant="outline">+</Button>
      </CardFooter>
    </Card>
  );
}

function DetailsCard({ comp }: {
  comp: Doc<"competitions">
}) {
  const iconUrl = `https://api.dicebear.com/9.x/glass/svg?seed=${comp.name}`;
  
  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center gap-4">
          <img
            src={iconUrl}
            className="size-12 shrink-0 rounded-lg border border-border object-cover"
          />
          <div className="flex flex-col gap-2 items-start">
            <CardTitle className="text-2xl">{comp?.name}</CardTitle>
            <DatePickerWithRange />
          </div>
        </div>
        <CardAction>
          <Button variant="outline" size="icon">
            <PencilIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent divided className="border-t">
        <Streamdown>{comp.description}</Streamdown>
        <ProgressTracker />
      </CardContent>
      <CardFooter>
        <Button size="lg" variant="secondary">
          <BellIcon />
          Watching
        </Button>
      </CardFooter>
    </Card>
  )
}

function Competition() {
  const comp = useQuery(api.competitions.queries.getFakeComp);
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 mx-auto w-full max-w-3xl gap-6">
      <DetailsCard />
      <PropertiesCard />
      <PeopleCard />
      <UpdateCard />
      <InlineDataView />
      <div className="h-96" />
    </div>
  );
}
