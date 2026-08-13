import { useNavigate } from "@tanstack/react-router"
import { useAction } from "convex/react"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { Page } from "@/components/layout/page"
import { api } from "@/convex/_generated/api"
import { unknownErrorMessage } from "@/convex/integrations/errorPayload"

const MISSING_RESPONSE_MESSAGE =
  "The provider did not return an authorization response. Start again from Admin → Service accounts."

export interface ServiceAccountCallbackSearch {
  code: string | undefined
  state: string | undefined
  error: string | undefined
  errorDescription: string | undefined
}

export function ServiceAccountCallbackPage({
  code,
  state,
  error,
  errorDescription,
}: ServiceAccountCallbackSearch) {
  const navigate = useNavigate()
  const completeConnect = useAction(
    api.integrations.serviceAccountConnect.completeConnect
  )

  // Deliberately never reset, unlike AuthCallbackPage's equivalent ref: React
  // StrictMode mounts effects twice in development, and the attempt is
  // single-use, so a second exchange would fail against an already-burnt state.
  const exchangedStateRef = useRef<string | null>(null)

  const completeConnectRef = useRef(completeConnect)
  useEffect(() => {
    completeConnectRef.current = completeConnect
  })

  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  })

  useEffect(() => {
    // `replace` keeps the authorization code out of session history and out of
    // any Referer sent by a later navigation.
    const returnToServiceAccounts = () =>
      void navigateRef.current({
        to: "/admin",
        search: { tab: "serviceAccounts" },
        replace: true,
      })

    if (error !== undefined) {
      toast.error(errorDescription ?? "The connection was cancelled or denied.")
      returnToServiceAccounts()
      return
    }
    if (code === undefined || state === undefined) {
      toast.error(MISSING_RESPONSE_MESSAGE)
      returnToServiceAccounts()
      return
    }
    if (exchangedStateRef.current === state) {
      return
    }
    exchangedStateRef.current = state

    void (async () => {
      try {
        const result = await completeConnectRef.current({ code, state })
        if (result.success) {
          toast.success(`${result.displayName} connected.`)
        } else {
          toast.error(result.message)
        }
      } catch (caught) {
        toast.error(unknownErrorMessage(caught, { includeConvexError: true }))
      }
      returnToServiceAccounts()
    })()
  }, [code, state, error, errorDescription])

  return <Page.Status variant="loading" message="Finishing connection…" />
}
