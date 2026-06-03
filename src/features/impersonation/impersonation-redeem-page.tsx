import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

function readTokenFromLocation(): string | null {
  if (typeof window === "undefined") {
    return null
  }
  return new URLSearchParams(window.location.search).get("token")
}

export function ImpersonationRedeemPage({
  title,
  redeem,
}: {
  title: string
  redeem: (token: string) => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const token = useMemo(() => readTokenFromLocation(), [])
  const tokenError =
    token === null || token.length === 0
      ? "Impersonation link is missing a token."
      : null
  const validToken = tokenError === null ? token : null

  useEffect(() => {
    if (validToken === null) {
      return
    }
    void (async () => {
      try {
        await redeem(validToken)
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Impersonation link is invalid or expired."
        )
      }
    })()
  }, [redeem, validToken])

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
