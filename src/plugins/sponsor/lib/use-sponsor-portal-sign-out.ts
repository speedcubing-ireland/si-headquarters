import { useNavigate } from "@tanstack/react-router"
import { useMutation } from "convex/react"
import { useCallback } from "react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import { sponsorAuthClient } from "@/plugins/sponsor/lib/sponsor-auth-client"
import {
  clearSponsorImpersonationSessionToken,
  useSponsorSessionToken,
} from "@/plugins/sponsor/lib/sponsor-session-token"

export function useSponsorPortalSignOut() {
  const navigate = useNavigate()
  const endSponsorImpersonation = useMutation(
    api.plugins.sponsor.impersonation.end
  )
  const { sessionToken, isImpersonating } = useSponsorSessionToken()

  return useCallback(async () => {
    if (isImpersonating && sessionToken !== null) {
      try {
        await endSponsorImpersonation({ sessionToken })
      } finally {
        clearSponsorImpersonationSessionToken()
      }
    } else {
      await sponsorAuthClient.signOut()
    }
    toast.success("Signed out.")
    await navigate({ to: "/sponsor/login" })
  }, [endSponsorImpersonation, isImpersonating, navigate, sessionToken])
}
