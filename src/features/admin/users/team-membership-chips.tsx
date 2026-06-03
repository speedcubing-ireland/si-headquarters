import { Toggle } from "@/components/ui/toggle"
import type { UserManagementTeam } from "@/features/admin/users/utils"
import type { Id } from "@/convex/_generated/dataModel"

export function TeamMembershipChips({
  teams,
  selectedTeamIds,
  onToggleTeam,
}: {
  teams: UserManagementTeam[]
  selectedTeamIds: Set<Id<"teams">>
  onToggleTeam: (teamId: Id<"teams">) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {teams.map((team) => {
        const selected = selectedTeamIds.has(team._id)
        return (
          <Toggle
            key={team._id}
            type="button"
            variant={selected ? "default" : "outline"}
            size="sm"
            pressed={selected}
            aria-label={`${selected ? "Remove from" : "Add to"} ${team.name}`}
            onPressedChange={() => {
              onToggleTeam(team._id)
            }}
          >
            {team.name}
          </Toggle>
        )
      })}
    </div>
  )
}
