import type { DataModel } from "../_generated/dataModel"
import { internal } from "../_generated/api"
import type { GenericActionCtx } from "convex/server"
import { ConvexError } from "convex/values"

function hasValidCliToken(cliToken: string | undefined): boolean {
  return Boolean(
    process.env.CLI_AUTH_TOKEN && cliToken === process.env.CLI_AUTH_TOKEN
  )
}

export async function requireSignedInAction(
  ctx: GenericActionCtx<DataModel>,
  cliToken?: string
): Promise<void> {
  if (hasValidCliToken(cliToken)) return
  if (cliToken) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Invalid CLI token",
    })
  }
  const signedIn = await ctx.runQuery(internal.core.auth.getIsSignedIn, {})
  if (!signedIn) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in required.",
    })
  }
}

export {
  // TODO: This needs to be implemented with authz is added
  requireSignedInAction as requireVolunteerAction,
  requireSignedInAction as requireDirectorAction,
  requireSignedInAction as requireDirectorOrVolunteerAction,
  requireSignedInAction as requireDirectorOrDelegateAction,
}
