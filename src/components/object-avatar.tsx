import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { PublicUser } from "@/convex/users/validators"
import type { Doc } from "@/convex/_generated/dataModel"

type ObjectType = "users" | "teams"
type ObjectByType = {
  users: PublicUser
  teams: Doc<"teams">
}

const DICEBEAR_INITIALS = "https://api.dicebear.com/9.x/initials/svg?seed="

function getStrInitials(name?: string) {
  if (!name) return "?"
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function ObjectAvatar<TType extends ObjectType>({
  obj,
  ...avatarProps
}: React.ComponentProps<typeof Avatar> & {
  obj: ObjectByType[TType]
}) {
  const name = obj.name
  const initials = getStrInitials(name)
  let avatarSrc = DICEBEAR_INITIALS + initials

  if ("image" in obj && obj.image) {
    avatarSrc = obj.image
  }

  return (
    <Avatar {...avatarProps}>
      <AvatarImage src={avatarSrc} alt={name ?? initials} />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}
