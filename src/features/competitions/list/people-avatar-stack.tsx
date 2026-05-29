import { ObjectAvatar } from "@/components/object-avatar"
import type { PublicUser } from "@/convex/users/validators"
import { cn } from "@/lib/utils"

export function PeopleAvatarStack({
  people,
  className,
}: {
  people: PublicUser[]
  className?: string
}) {
  if (people.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const visible = people.slice(0, 3)

  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {visible.map((person) => (
        <ObjectAvatar key={person._id} obj={person} size="sm" />
      ))}
    </div>
  )
}
