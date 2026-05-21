import Google from "@auth/core/providers/google"
import type { OAuthConfig, OAuthUserConfig } from "@auth/core/providers"
import { convexAuth } from "@convex-dev/auth/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { ConvexError, v } from "convex/values"
import {
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server"
import type { Id } from "../_generated/dataModel"
import { WCA_BASE_URL } from "../integrations/wca"
import { z } from "zod"

const wcaMeSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  avatar: z.optional(
    z.object({
      url: z.optional(z.string()),
      thumb_url: z.optional(z.string()),
    })
  ),
})

function WCA(
  options: OAuthUserConfig<{
    id: number
    email: string
    created_at: string
    updated_at: string
  }>
): OAuthConfig<{
  id: number
  email: string
  created_at: string
  updated_at: string
}> {
  return {
    id: "wca",
    name: "WCA",
    type: "oauth",
    checks: ["state"],
    authorization: {
      url: `${WCA_BASE_URL}/oauth/authorize`,
      params: {
        scope: "public email",
      },
    },
    token: `${WCA_BASE_URL}/oauth/token`,
    userinfo: `${WCA_BASE_URL}/api/v0/me`,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    profile(profile) {
      const me = wcaMeSchema.parse(profile)
      return {
        id: String(me.id),
        name: me.name,
        email: me.email,
        image: me.avatar?.url ?? me.avatar?.thumb_url,
      }
    },
  }
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      authorization: {
        params: {
          hd: "speedcubingireland.com",
        },
      },
    }),
    WCA({
      clientId: process.env.AUTH_WCA_ID,
      clientSecret: process.env.AUTH_WCA_SECRET,
    }),
  ],
})

type AuthCtx = QueryCtx | MutationCtx

export async function requireUserId(ctx: AuthCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in required.",
    })
  }
  return userId
}

export async function isSignedIn(ctx: AuthCtx): Promise<boolean> {
  return (await getAuthUserId(ctx)) !== null
}

async function getIsSignedInHandler(ctx: AuthCtx): Promise<boolean> {
  return isSignedIn(ctx)
}

const isSignedInPublicQuery = query({
  args: {},
  returns: v.boolean(),
  handler: getIsSignedInHandler,
})

export {
  // TODO: When authz is added we need to rework these
  isSignedIn as isVolunteer,
  isSignedInPublicQuery as isSignedInQuery,
  isSignedInPublicQuery as isVolunteerQuery,
  isSignedInPublicQuery as getIsSignedIn,
  isSignedInPublicQuery as getIsVolunteer,
  isSignedInPublicQuery as getIsDirector,
}
