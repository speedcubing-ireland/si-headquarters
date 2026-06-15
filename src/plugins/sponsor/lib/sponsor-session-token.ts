import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { sponsorAuthClient } from "@/plugins/sponsor/lib/sponsor-auth-client"

const SPONSOR_IMPERSONATION_SESSION_KEY =
  "si:sponsor-impersonation-session-token"
const SPONSOR_IMPERSONATION_EVENT = "si:sponsor-impersonation-session-change"

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null
  return window.sessionStorage.getItem(SPONSOR_IMPERSONATION_SESSION_KEY)
}

function notifyTokenChange(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SPONSOR_IMPERSONATION_EVENT))
}

export function storeSponsorImpersonationSessionToken(token: string): void {
  window.sessionStorage.setItem(SPONSOR_IMPERSONATION_SESSION_KEY, token)
  notifyTokenChange()
}

export function clearSponsorImpersonationSessionToken(): void {
  window.sessionStorage.removeItem(SPONSOR_IMPERSONATION_SESSION_KEY)
  notifyTokenChange()
}

export function useSponsorSessionToken() {
  const { data: authSession, isPending } = sponsorAuthClient.useSession()
  const [impersonationToken, setImpersonationToken] = useState(readStoredToken)

  useEffect(() => {
    const update = () => {
      setImpersonationToken(readStoredToken())
    }
    window.addEventListener(SPONSOR_IMPERSONATION_EVENT, update)
    window.addEventListener("storage", update)
    return () => {
      window.removeEventListener(SPONSOR_IMPERSONATION_EVENT, update)
      window.removeEventListener("storage", update)
    }
  }, [])

  if (impersonationToken !== null && impersonationToken.length > 0) {
    return {
      sessionToken: impersonationToken,
      isPending: false,
      isImpersonating: true,
    }
  }

  return {
    sessionToken: authSession?.session.token ?? null,
    isPending,
    isImpersonating: false,
  }
}

export function useRequireSponsorSession() {
  const navigate = useNavigate()
  const { sessionToken, isPending: authPending } = useSponsorSessionToken()

  useEffect(() => {
    if (authPending || sessionToken !== null) {
      return
    }
    void navigate({ to: "/sponsor/login" })
  }, [authPending, navigate, sessionToken])

  return { sessionToken, authPending }
}
