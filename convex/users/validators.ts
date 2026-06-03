import { v, type Infer } from "convex/values"
import { permissionValidator } from "@/convex/permissions/shared"
import { teamSummary } from "@/convex/teams/validators"

export const usersFields = {
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  emailVerificationTime: v.optional(v.number()),
  phone: v.optional(v.string()),
  phoneVerificationTime: v.optional(v.number()),
  isAnonymous: v.optional(v.boolean()),
  disabled: v.optional(v.boolean()),
  discordUserId: v.optional(v.string()),
  discordUsername: v.optional(v.string()),
  discordDisplayName: v.optional(v.string()),
  discordAvatarHash: v.optional(v.string()),
  discordLinkedAt: v.optional(v.number()),
  discordLinkedBy: v.optional(v.id("users")),
}

export const publicUserFields = {
  _id: v.id("users"),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
}

export const publicUserValidator = v.object(publicUserFields)

export type PublicUser = Infer<typeof publicUserValidator>

export const discordLinkValidator = v.object({
  discordUserId: v.string(),
  discordUsername: v.string(),
  discordDisplayName: v.string(),
  discordAvatarHash: v.optional(v.string()),
})

export const adminDiscordUpdateValidator = v.union(
  v.object({ kind: v.literal("unchanged") }),
  v.object({ kind: v.literal("unlink") }),
  v.object({
    kind: v.literal("link"),
    member: discordLinkValidator,
  })
)

export const adminUserSummaryValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  disabled: v.boolean(),
  avatarUrl: v.optional(v.string()),
  discordUserId: v.optional(v.string()),
  discordUsername: v.optional(v.string()),
  discordDisplayName: v.optional(v.string()),
  discordAvatarHash: v.optional(v.string()),
  discordLinkedAt: v.optional(v.number()),
  teams: v.array(teamSummary),
  effectivePermissions: v.array(permissionValidator),
})

export type DiscordLink = Infer<typeof discordLinkValidator>
export type AdminDiscordUpdate = Infer<typeof adminDiscordUpdateValidator>
export type AdminUserSummary = Infer<typeof adminUserSummaryValidator>
