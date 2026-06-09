import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { useEndSponsorImpersonation } from "@/plugins/sponsor/impersonation/use-end-sponsor-impersonation"
import { sponsorAuthClient } from "@/plugins/sponsor/lib/sponsor-auth-client"
import { useSponsorSessionToken } from "@/plugins/sponsor/lib/sponsor-session-token"

export function useSponsorPortalSignOut() {
  const navigate = useNavigate()
  const endImpersonation = useEndSponsorImpersonation()
  const { sessionToken, isImpersonating } = useSponsorSessionToken()

  return async () => {
    if (isImpersonating && sessionToken !== null) {
      await endImpersonation(sessionToken)
    } else {
      await sponsorAuthClient.signOut()
    }
    toast.success("Signed out.")
    await navigate({ to: "/sponsor/login" })
  }
}
