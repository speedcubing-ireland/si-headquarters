import { Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import type { SubmitEvent } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { SponsorButtonSpinner } from "@/plugins/sponsor/components/sponsor-ui"
import { SPONSOR_LOGIN_STEPS } from "@/plugins/sponsor/lib/sponsor-guide"
import { sponsorAuthClient } from "@/plugins/sponsor/lib/sponsor-auth-client"
import { useSponsorSessionToken } from "@/plugins/sponsor/lib/sponsor-session-token"

const OTP_REQUEST_UI_TIMEOUT_MS = 3_000

export function PortalLoginPage() {
  const navigate = useNavigate()
  const { data: session, isPending } = sponsorAuthClient.useSession()
  const { sessionToken: storedSessionToken } = useSponsorSessionToken()
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    if (!session && storedSessionToken === null) return
    void navigate({ to: "/sponsor/auctions" })
  }, [navigate, session, storedSessionToken])

  const normalizedEmail = email.trim().toLowerCase()

  const ensureNoAuthError = (
    result: { error?: { message?: string | null } | null },
    fallback: string
  ) => {
    if (result.error) {
      throw new Error(result.error.message ?? fallback)
    }
  }

  const runAuthAction = async (
    task: () => Promise<void>,
    fallbackMessage: string
  ) => {
    setIsBusy(true)
    try {
      await task()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : fallbackMessage
      toast.error(message)
    } finally {
      setIsBusy(false)
    }
  }

  const runOtpSendAction = async (
    task: () => Promise<void>,
    successMessage: string,
    fallbackMessage: string
  ): Promise<boolean> => {
    const timedOut = Symbol("otp-send-timeout")
    setIsBusy(true)
    const request = task()
    try {
      const result = await Promise.race([
        request.then(() => "completed" as const),
        new Promise<typeof timedOut>((resolve) => {
          setTimeout(() => {
            resolve(timedOut)
          }, OTP_REQUEST_UI_TIMEOUT_MS)
        }),
      ])
      if (result === timedOut) {
        toast.success(successMessage)
        void (async () => {
          try {
            await request
          } catch (caught) {
            const message =
              caught instanceof Error ? caught.message : fallbackMessage
            const normalized = message.toLowerCase()
            if (
              !normalized.includes("timed out") &&
              !normalized.includes("timeout")
            ) {
              toast.error(message)
            }
          }
        })()
        return true
      }
      toast.success(successMessage)
      return true
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : fallbackMessage
      const normalized = message.toLowerCase()
      if (normalized.includes("timed out") || normalized.includes("timeout")) {
        toast.success(successMessage)
        return true
      }
      toast.error(message)
      return false
    } finally {
      setIsBusy(false)
    }
  }

  const onSendSignInOtp = async () => {
    const sent = await runOtpSendAction(
      async () => {
        const result = await sponsorAuthClient.emailOtp.sendVerificationOtp({
          email: normalizedEmail,
          type: "sign-in",
        })
        ensureNoAuthError(result, "Failed to send code.")
      },
      "Sign-in code sent.",
      "Failed to send code."
    )
    if (sent) setOtpSent(true)
  }

  const onOtpSignIn = async (event: SubmitEvent) => {
    event.preventDefault()
    await runAuthAction(async () => {
      const result = await sponsorAuthClient.signIn.emailOtp({
        email: normalizedEmail,
        otp,
      })
      ensureNoAuthError(result, "Failed to sign in.")
      toast.success("Signed in.")
      await navigate({ to: "/sponsor/auctions" })
    }, "Failed to sign in.")
  }

  return (
    <div className="min-h-svh bg-linear-to-b from-muted/40 to-background px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-4">
        {isPending ? (
          <Card className="border-muted-foreground/10 shadow-sm">
            <CardContent className="flex items-center justify-center py-10">
              <Spinner className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-muted-foreground/10 shadow-sm">
              <CardHeader className="space-y-3">
                <Badge className="w-fit" variant="secondary">
                  Sponsor Portal
                </Badge>
                <CardTitle className="text-2xl">Sponsor sign-in</CardTitle>
                <CardDescription className="space-y-2">
                  <span className="block">
                    Enter the email address Speedcubing Ireland has on file for
                    your sponsor account.
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      setOtpSent(false)
                    }}
                    required
                    disabled={isBusy}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="border-muted-foreground/10 shadow-sm">
              <CardContent className="space-y-6 pt-6">
                <form
                  className="space-y-3"
                  onSubmit={(event) => void onOtpSignIn(event)}
                >
                  <Label htmlFor="otp">One-time email code</Label>
                  <p className="text-sm text-muted-foreground">
                    We email you a one-time code. Delivery can take up to 2
                    minutes.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBusy || !normalizedEmail}
                    onClick={() => void onSendSignInOtp()}
                  >
                    Send code
                  </Button>
                  <Input
                    id="otp"
                    value={otp}
                    onChange={(event) => {
                      setOtp(event.target.value)
                    }}
                    placeholder="One-time code"
                    className="min-w-44 font-mono tracking-[0.2em]"
                    required
                    disabled={isBusy}
                  />
                  <Button
                    className="w-full"
                    type="submit"
                    disabled={isBusy || !normalizedEmail || !otpSent}
                  >
                    {isBusy ? <SponsorButtonSpinner /> : "Sign in"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    {SPONSOR_LOGIN_STEPS[5]}
                  </p>
                </form>
              </CardContent>
            </Card>
            <Card className="border-muted-foreground/10 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Getting logged in</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {SPONSOR_LOGIN_STEPS.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  After signing in, open{" "}
                  <Link
                    to="/sponsor/guide"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    sponsor information
                  </Link>{" "}
                  for auction formats and bidding rules.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
