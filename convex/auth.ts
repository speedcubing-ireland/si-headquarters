import { convexAuth } from "@convex-dev/auth/server"
import Google from "@auth/core/providers/google"
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials"
import { internal } from "@/convex/_generated/api"

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      authorization: {
        params: {
          hd: "speedcubingireland.com",
        },
      },
    }),
    ConvexCredentials({
      id: "impersonation",
      authorize: async (credentials, ctx) => {
        const token = credentials.token
        if (typeof token !== "string") {
          return null
        }
        return await ctx.runMutation(
          internal.impersonation.internal.redeemUserTokenForAuth,
          { token }
        )
      },
    }),
  ],
})
