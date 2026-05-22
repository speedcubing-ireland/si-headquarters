import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PencilIcon } from "lucide-react"
import { Streamdown } from "streamdown"
import DemoContent from "../../../../DEMO_CONTENT.md?raw"

export function UpdateCard() {
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
