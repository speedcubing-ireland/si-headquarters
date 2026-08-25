import { ORGANISER_INVITE_PATH } from "@/convex/competitions/invites/validators"
import { SERVICE_ACCOUNT_OAUTH_CALLBACK_PATH } from "@/convex/integrations/serviceAccountPaths"
import { STAFF_WCA_LOGIN_PATH } from "@/convex/wcaLogin/wcaLoginPaths"

/**
 * Routes that receive an OAuth `?code=` belonging to a provider other than
 * Convex Auth.
 *
 * `ConvexAuthProvider` looks for `code` in the URL on mount and, when it finds
 * one, deletes it from the URL and redeems it as its own sign-in code — and
 * takes that branch *instead of* restoring the existing session from storage.
 * On a route handling someone else's authorization code that means the code is
 * silently swallowed and the signed-in user appears logged out.
 *
 * Any new route that handles a third-party authorization code must be added
 * here.
 */
const NON_CONVEX_AUTH_CODE_PATHS: readonly string[] = [
  ORGANISER_INVITE_PATH,
  STAFF_WCA_LOGIN_PATH,
  SERVICE_ACCOUNT_OAUTH_CALLBACK_PATH,
]

export function shouldHandleAuthCode(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/"
  return !NON_CONVEX_AUTH_CODE_PATHS.includes(normalized)
}
