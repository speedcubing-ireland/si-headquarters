import { useCallback, useMemo, useState } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import type { AdminDiscordUpdate } from "@/convex/users/validators"
import type { AdminUser } from "@/features/admin/users/utils"

export interface UserManagementDraft {
  enabled: boolean
  teamIds: Set<Id<"teams">>
  discord: AdminDiscordUpdate
}

interface DraftState {
  userId: Id<"users">
  draft: UserManagementDraft
}

function teamIdsFromUser(user: AdminUser): Set<Id<"teams">> {
  return new Set(user.teams.map((team) => team._id))
}

export function createDraftFromUser(user: AdminUser): UserManagementDraft {
  return {
    enabled: !user.disabled,
    teamIds: teamIdsFromUser(user),
    discord: { kind: "unchanged" },
  }
}

function discordDraftEquals(
  draft: AdminDiscordUpdate,
  user: AdminUser
): boolean {
  if (draft.kind === "unchanged") {
    return true
  }
  if (draft.kind === "unlink") {
    return user.discordUserId === undefined
  }
  return user.discordUserId === draft.member.discordUserId
}

export function isDraftDirty(
  draft: UserManagementDraft,
  user: AdminUser
): boolean {
  if (draft.enabled !== !user.disabled) {
    return true
  }

  const savedTeamIds = teamIdsFromUser(user)
  if (draft.teamIds.size !== savedTeamIds.size) {
    return true
  }
  for (const teamId of draft.teamIds) {
    if (!savedTeamIds.has(teamId)) {
      return true
    }
  }

  if (!discordDraftEquals(draft.discord, user)) {
    return true
  }

  return false
}

export function useUserManagementDraft(user: AdminUser | null | undefined) {
  const [draftState, setDraftState] = useState<DraftState | null>(null)

  const draft = useMemo(() => {
    if (user === null || user === undefined) {
      return null
    }
    if (draftState?.userId === user._id) {
      return draftState.draft
    }
    return createDraftFromUser(user)
  }, [draftState, user])

  const dirty = useMemo(() => {
    if (user === null || user === undefined || draft === null) {
      return false
    }
    return isDraftDirty(draft, user)
  }, [draft, user])

  const updateDraft = useCallback(
    (updater: (current: UserManagementDraft) => UserManagementDraft) => {
      if (user === null || user === undefined) {
        return
      }
      setDraftState((current) => {
        const currentDraft =
          current?.userId === user._id
            ? current.draft
            : createDraftFromUser(user)
        return {
          userId: user._id,
          draft: updater(currentDraft),
        }
      })
    },
    [user]
  )

  const toggleTeam = useCallback(
    (teamId: Id<"teams">) => {
      updateDraft((current) => {
        const teamIds = new Set(current.teamIds)
        if (teamIds.has(teamId)) {
          teamIds.delete(teamId)
        } else {
          teamIds.add(teamId)
        }
        return { ...current, teamIds }
      })
    },
    [updateDraft]
  )

  return {
    draft,
    dirty,
    updateDraft,
    toggleTeam,
  }
}
