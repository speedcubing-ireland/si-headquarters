import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  ClipboardPenIcon,
  FlagIcon,
  MessageCirclePlusIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"

export function PeopleCard() {
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
