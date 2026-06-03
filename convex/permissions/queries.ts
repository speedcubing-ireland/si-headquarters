import { internalQuery, query } from "@/convex/_generated/server"
import {
  buildPrincipalForUserId,
  canAccessSponsorPortalAdminForUser,
  getPrincipalOrNull,
  permissionsFor,
  requireUserManagement,
} from "@/convex/permissions/principal"
import { permissionValidator } from "@/convex/permissions/shared"
import { v } from "convex/values"

export const currentPermissions = query({
  args: {},
  returns: v.object({
    permissions: v.array(permissionValidator),
  }),
  handler: async (ctx) => {
    const principal = await getPrincipalOrNull(ctx)
    return {
      permissions: permissionsFor(principal),
    }
  },
})

export const assertUserManagement = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireUserManagement(ctx)
    return null
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
