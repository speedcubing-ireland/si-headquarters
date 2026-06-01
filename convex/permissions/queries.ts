import { internalQuery, query } from "@/convex/_generated/server"
import {
  buildPrincipalForUserId,
  canAccessSponsorPortalAdminForUser,
  getPrincipalOrNull,
  permissionsFor,
} from "@/convex/permissions/principal"
import { v } from "convex/values"

export const currentPermissions = query({
  args: {},
  returns: v.object({
    permissions: v.array(
      v.object({
        action: v.union(
          v.literal("read"),
          v.literal("create"),
          v.literal("update"),
          v.literal("delete"),
          v.literal("manage"),
          v.literal("access")
        ),
        subject: v.union(
          v.literal("all"),
          v.literal("Competition"),
          v.literal("Task"),
          v.literal("Team"),
          v.literal("User"),
          v.literal("UserManagement"),
          v.literal("SponsorPortalAdmin")
        ),
      })
    ),
  }),
  handler: async (ctx) => {
    const principal = await getPrincipalOrNull(ctx)
    return {
      permissions: permissionsFor(principal),
    }
  },
})

export const canAccessSponsorPortalAdminForUserId = internalQuery({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const principal = await buildPrincipalForUserId(ctx, args.userId)
    if (principal === null) {
      return false
    }
    return canAccessSponsorPortalAdminForUser(principal)
  },
})
