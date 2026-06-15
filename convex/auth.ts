import { convexAuth } from "@convex-dev/auth/server"
import Google from "@auth/core/providers/google"
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials"
import { internal } from "@/convex/_generated/api"
import { exchangeWcaCodeForProfile } from "@/convex/organisers/wcaLogin"

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
      id: "wca",
      authorize: async (credentials, ctx) => {
        const code = credentials.code
        if (typeof code !== "string" || code.length === 0) {
          return null
        }
        const inviteToken =
          typeof credentials.inviteToken === "string" &&
          credentials.inviteToken.length > 0
            ? credentials.inviteToken
            : undefined
        const profile = await exchangeWcaCodeForProfile(code)
        if (profile === null) {
          return null
        }
        return ctx.runMutation(internal.organisers.internal.signInWithWca, {
          ...profile,
          inviteToken,
        })
      },
    }),
    ConvexCredentials({
      id: "impersonation",
      authorize: async (credentials, ctx) => {
        const token = credentials.token
        const consumptionNonce = credentials.consumptionNonce
        if (typeof token !== "string" || typeof consumptionNonce !== "string") {
          return null
        }
        return await ctx.runMutation(
          internal.impersonation.internal.redeemUserTokenForAuth,
          { token, consumptionNonce }
        )
      },
    }),
  ],
})
