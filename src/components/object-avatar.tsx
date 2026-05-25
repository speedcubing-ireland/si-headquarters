import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { PublicUser } from "@/convex/users/validators"
import type { Doc } from "@/convex/_generated/dataModel"

type ObjectType = "users" | "teams"
interface ObjectByType {
  users: PublicUser
  teams: Pick<Doc<"teams">, "_id" | "name">
}

const DICEBEAR_INITIALS = "https://api.dicebear.com/9.x/initials/svg?seed="

function getStrInitials(name?: string) {
  if (name === undefined || name.length === 0) return "?"
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function ObjectAvatar({
  obj,
  ...avatarProps
}: React.ComponentProps<typeof Avatar> & {
  obj: ObjectByType[ObjectType]
}) {
  const name = obj.name
  const initials = getStrInitials(name)
  let avatarSrc = DICEBEAR_INITIALS + initials

  if ("image" in obj && obj.image !== undefined) {
    avatarSrc = obj.image
  }

  return (
    <Avatar {...avatarProps}>
      <AvatarImage src={avatarSrc} alt={name ?? initials} />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}
