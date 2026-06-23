import { convexAuth } from "@convex-dev/auth/server"
import Google from "@auth/core/providers/google"
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials"
import { internal } from "@/convex/_generated/api"
import { exchangeWcaCodeForProfile } from "@/convex/wcaLogin/wcaLogin"
import { loginProvider } from "@/config/lib/organisation"

const google = loginProvider("google")
const wca = loginProvider("wca")
const wcaStaff = loginProvider("wca-staff")

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    ...(google !== undefined
      ? [
          Google({
            authorization: {
              params: {
                hd: google.hostedDomain,
              },
            },
          }),
        ]
      : []),
    ...(wca !== undefined
      ? [
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
              const profile = await exchangeWcaCodeForProfile(code, "organiser")
              if (profile === null) {
                return null
              }
              return ctx.runMutation(internal.wcaLogin.internal.signInWithWca, {
                ...profile,
                inviteToken,
              })
            },
          }),
        ]
      : []),
    ...(wcaStaff !== undefined
      ? [
          ConvexCredentials({
            id: "wca-staff",
            authorize: async (credentials, ctx) => {
              const code = credentials.code
              if (typeof code !== "string" || code.length === 0) {
                return null
              }
              const profile = await exchangeWcaCodeForProfile(code, "staff")
              if (profile === null) {
                return null
              }
              // No invite token: signInWithWca admits only accounts that
              // already exist in the users table by wcaUserId.
              return ctx.runMutation(
                internal.wcaLogin.internal.signInWithWca,
                profile
              )
            },
          }),
        ]
      : []),
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
