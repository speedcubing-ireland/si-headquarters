import { describe, expect, test } from "vitest"
import { ORGANISER_INVITE_PATH } from "@/convex/competitions/invites/validators"
import { SERVICE_ACCOUNT_OAUTH_CALLBACK_PATH } from "@/convex/integrations/serviceAccountPaths"
import { STAFF_WCA_LOGIN_PATH } from "@/convex/wcaLogin/wcaLoginPaths"
import { shouldHandleAuthCode } from "@/lib/auth-code-paths"

describe("shouldHandleAuthCode", () => {
  // Missing one of these lets ConvexAuthProvider swallow the provider's `code`
  // and drop the signed-in user on that route.
  test.for([
    ORGANISER_INVITE_PATH,
    STAFF_WCA_LOGIN_PATH,
    SERVICE_ACCOUNT_OAUTH_CALLBACK_PATH,
  ])("leaves %s for the route to handle", (path) => {
    expect(shouldHandleAuthCode(path)).toBe(false)
    expect(shouldHandleAuthCode(`${path}/`)).toBe(false)
  })

  test.for(["/", "/admin", "/dashboard", "/admin/service-accounts"])(
    "lets Convex Auth handle a code on %s",
    (path) => {
      expect(shouldHandleAuthCode(path)).toBe(true)
    }
  )
})
