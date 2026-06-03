import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { impersonationTokenFromSearch } from "@/features/impersonation/impersonation-token"
import { cn } from "@/lib/utils"

export function ImpersonationRedeemPage({
  title,
  redeem,
}: {
  title: string
  redeem: (token: string) => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const token = useMemo(() => impersonationTokenFromSearch(), [])
  const tokenError =
    token === null ? "Impersonation link is missing a token." : null

  const redeemRef = useRef(redeem)
  useEffect(() => {
    redeemRef.current = redeem
  })

  const attemptedTokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (token === null) {
      return
    }

    if (attemptedTokenRef.current === token) {
      return
    }
    attemptedTokenRef.current = token

    const cancelledRef = { current: false }
    void (async () => {
      try {
        await redeemRef.current(token)
      } catch (caught) {
        if (cancelledRef.current) {
          return
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "Impersonation link is invalid or expired."
        )
      }
    })()

    return () => {
      cancelledRef.current = true
      if (attemptedTokenRef.current === token) {
        attemptedTokenRef.current = null
      }
    }
  }, [token])

  const displayError = tokenError ?? error

  return (
    <div
      className={cn(
        "flex min-h-svh items-center justify-center bg-muted/40 px-4"
      )}
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
          {displayError ?? (
            <div className="flex items-center gap-2">
              <Spinner />
              Opening impersonated session...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
