import type { Doc } from "@/convex/_generated/dataModel"
import { permissionsFor } from "@/convex/permissions/principal"
import { isTeamName } from "@/convex/permissions/shared"
import type { TeamSummary } from "@/convex/teams/validators"
import { resolveUserAvatarUrl } from "@/convex/users/avatar"
import type { AdminUserSummary } from "@/convex/users/validators"

export function toAdminUserSummary(
  user: Doc<"users">,
  teams: TeamSummary[]
): AdminUserSummary {
  const teamNames = teams.map((team) => team.name).filter(isTeamName)

  return {
    _id: user._id,
    _creationTime: user._creationTime,
    name: user.name,
    image: user.image,
    email: user.email,
    disabled: user.disabled === true,
    avatarUrl: resolveUserAvatarUrl(user),
    discordUserId: user.discordUserId,
    discordUsername: user.discordUsername,
    discordDisplayName: user.discordDisplayName,
    discordAvatarHash: user.discordAvatarHash,
    discordLinkedAt: user.discordLinkedAt,
    teams,
    effectivePermissions: permissionsFor({ userId: user._id, teamNames }),
  }
}
