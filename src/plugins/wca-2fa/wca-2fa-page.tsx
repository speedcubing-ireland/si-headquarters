import {
  AlertTriangle,
  Copy,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Page, PAGE_CONTENT_PADDING } from "@/components/layout/page"
import { AbilityRouteGuard } from "@/features/auth"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useWca2faCode } from "@/plugins/wca-2fa/use-wca-2fa-code"

function OtpCodeDisplay({ code, digits }: { code: string; digits: number }) {
  const splitAt = Math.ceil(digits / 2)
  const indexes = Array.from({ length: digits }, (_, index) => index)
  return (
    <InputOTP
      maxLength={digits}
      value={code}
      readOnly
      containerClassName="justify-center"
      className="font-mono"
      aria-label="Current WCA verification code"
    >
      <InputOTPGroup>
        {indexes.slice(0, splitAt).map((index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className="size-12 text-xl font-semibold sm:size-14 sm:text-2xl"
          />
        ))}
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        {indexes.slice(splitAt).map((index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className="size-12 text-xl font-semibold sm:size-14 sm:text-2xl"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}

function Wca2faContent() {
  const {
    codeState,
    error,
    isFetching,
    hasLoaded,
    serverOffsetMs,
    refreshCode,
  } = useWca2faCode()
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const syncedNowMs = nowMs + serverOffsetMs
  const remainingMs = useMemo(() => {
    if (codeState === null) {
      return 0
    }
    return Math.max(codeState.expiresAtMs - syncedNowMs, 0)
  }, [codeState, syncedNowMs])
  const hasCode = codeState !== null
  const isCodeActive = hasCode && remainingMs > 0
  const periodMs = (codeState?.periodSeconds ?? 30) * 1000
  const progress = isCodeActive
    ? Math.min(Math.max(remainingMs / periodMs, 0), 1)
    : 0
  const secondsRemaining = isCodeActive ? Math.ceil(remainingMs / 1000) : 0
  const visibleCode = codeState !== null && remainingMs > 0 ? codeState : null

  const copyCode = async () => {
    if (codeState === null || !isCodeActive) {
      return
    }
    try {
      await navigator.clipboard.writeText(codeState.code)
      toast.success("Code copied.")
    } catch {
      toast.error("Could not copy code.")
    }
  }

  const expiryVariant = !hasCode
    ? "outline"
    : isCodeActive
      ? secondsRemaining <= 5
        ? "destructive"
        : "secondary"
      : "destructive"

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <CardTitle>Verification code</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {!hasCode ? (
                <Badge variant={expiryVariant}>Ready</Badge>
              ) : isCodeActive ? (
                <Badge variant={expiryVariant}>
                  Expires in {secondsRemaining}s
                </Badge>
              ) : (
                <Badge variant={expiryVariant}>Expired</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Expiry</span>
              <span className="font-medium tabular-nums">
                {isCodeActive
                  ? `${String(secondsRemaining)}s`
                  : "No active code"}
              </span>
            </div>
            <Progress
              value={progress * 100}
              indicatorClassName={
                secondsRemaining <= 5 ? "bg-destructive" : undefined
              }
            />
          </div>

          <div className="flex flex-col items-center gap-4 py-3">
            {visibleCode !== null ? (
              <OtpCodeDisplay
                code={visibleCode.code}
                digits={visibleCode.digits}
              />
            ) : (
              <div className="py-3 text-center">
                <p className="text-sm font-medium">Code unavailable</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate a new code to continue.
                </p>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="default"
                onClick={() => {
                  void refreshCode()
                }}
                disabled={isFetching}
              >
                {isFetching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {hasCode ? "Generate new code" : "Generate code"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void copyCode()
                }}
                disabled={!isCodeActive}
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
          </div>
          {error !== null ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Code unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {error === null && !hasLoaded ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Generating secure code...
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

export function Wca2faPage() {
  return (
    <AbilityRouteGuard
      action="access"
      subject="Wca2fa"
      deniedMessage="Directors, Delegates, or Competitions Team access is required."
      loadingMessage="Loading WCA 2FA…"
    >
      <Page.Shell
        title="WCA 2FA"
        contentClassName={cn(PAGE_CONTENT_PADDING, "flex flex-col gap-4")}
      >
        <Wca2faContent />
      </Page.Shell>
    </AbilityRouteGuard>
  )
}
