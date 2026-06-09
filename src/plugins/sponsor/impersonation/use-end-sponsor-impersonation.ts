import { useMutation } from "convex/react"
import { useCallback } from "react"
import { api } from "@/convex/_generated/api"
import { clearSponsorImpersonationSessionToken } from "@/plugins/sponsor/lib/sponsor-session-token"

export function useEndSponsorImpersonation() {
  const endSponsorImpersonation = useMutation(
    api.plugins.sponsor.impersonation.end
  )

  return useCallback(
    async (sessionToken: string) => {
      try {
        await endSponsorImpersonation({ sessionToken })
      } finally {
        clearSponsorImpersonationSessionToken()
      }
    },
    [endSponsorImpersonation]
  )
}
