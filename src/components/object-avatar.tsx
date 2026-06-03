import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { PublicUser } from "@/convex/users/validators"
import type { Doc } from "@/convex/_generated/dataModel"
import { dicebearInitialsUrl } from "@/convex/users/avatar"

type ObjectType = "users" | "teams"
interface ObjectByType {
  users: PublicUser
  teams: Pick<Doc<"teams">, "_id" | "name">
}

function getStrInitials(name?: string) {
  if (name === undefined || name.length === 0) return "?"
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function resolveAvatarSrc(
  obj: ObjectByType[ObjectType],
  avatarUrl: string | undefined
): string {
  if (avatarUrl !== undefined) {
    return avatarUrl
  }
  if ("image" in obj && obj.image !== undefined && obj.image.length > 0) {
    return obj.image
  }
  const seed = obj.name?.trim()
  if (seed !== undefined && seed.length > 0) {
    return dicebearInitialsUrl(seed)
  }
  return dicebearInitialsUrl(getStrInitials(obj.name))
}

export function ObjectAvatar({
  obj,
  avatarUrl,
  ...avatarProps
}: React.ComponentProps<typeof Avatar> & {
  obj: ObjectByType[ObjectType]
  avatarUrl?: string
}) {
  const name = obj.name
  const initials = getStrInitials(name)
  const avatarSrc = resolveAvatarSrc(obj, avatarUrl)

  return (
    <Avatar {...avatarProps}>
      <AvatarImage src={avatarSrc} alt={name ?? initials} />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}
