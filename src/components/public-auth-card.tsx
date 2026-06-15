import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

function PublicAuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">{children}</Card>
    </div>
  )
}

export function PublicAuthMessage({
  title,
  message,
  description,
  children,
}: {
  title: string
  message?: string
  description?: string
  children?: ReactNode
}) {
  return (
    <PublicAuthCard>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description !== undefined && description.length > 0 ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>
      {message !== undefined && message.length > 0 ? (
        <CardContent className="text-sm text-muted-foreground">
          {message}
        </CardContent>
      ) : null}
      {children}
    </PublicAuthCard>
  )
}

export function AuthCallbackPage({
  title,
  credential,
  missingMessage,
  loadingMessage,
  defaultErrorMessage = missingMessage,
  redeem,
}: {
  title: string
  credential: string | undefined
  missingMessage: string
  loadingMessage: string
  defaultErrorMessage?: string
  redeem: (credential: string) => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const credentialError = credential === undefined ? missingMessage : null

  const redeemRef = useRef(redeem)
  useEffect(() => {
    redeemRef.current = redeem
  })

  const attemptedCredentialRef = useRef<string | null>(null)

  useEffect(() => {
    if (credential === undefined) {
      return
    }

    if (attemptedCredentialRef.current === credential) {
      return
    }
    attemptedCredentialRef.current = credential

    const cancelledRef = { current: false }
    void (async () => {
      try {
        await redeemRef.current(credential)
      } catch (caught) {
        if (cancelledRef.current) {
          return
        }
        setError(caught instanceof Error ? caught.message : defaultErrorMessage)
      }
    })()

    return () => {
      cancelledRef.current = true
      if (attemptedCredentialRef.current === credential) {
        attemptedCredentialRef.current = null
      }
    }
  }, [credential, defaultErrorMessage])

  const displayError = credentialError ?? error

  return (
    <PublicAuthCard>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
        {displayError ?? (
          <div className="flex items-center gap-2">
            <Spinner />
            {loadingMessage}
          </div>
        )}
      </CardContent>
    </PublicAuthCard>
  )
}
