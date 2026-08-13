import { formatDistanceStrict } from "date-fns"
import { useAction, useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  PlugIcon,
  RefreshCwIcon,
  UnplugIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Page } from "@/components/layout/page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/convex/_generated/api"
import { unknownErrorMessage } from "@/convex/integrations/errorPayload"
import { formatDateTime } from "@/lib/format/dates"
import { serviceAccountStatus, type ServiceAccountStatus } from "./status"

type ServiceAccount = FunctionReturnType<
  typeof api.integrations.tokensStore.listServiceAccounts
>[number]

const STATUS_DISPLAY: Record<
  ServiceAccountStatus,
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
    icon: typeof CircleCheckIcon
  }
> = {
  healthy: {
    label: "Healthy",
    variant: "default",
    icon: CircleCheckIcon,
  },
  expiring: {
    label: "Expiring soon",
    variant: "secondary",
    icon: CircleAlertIcon,
  },
  expired: {
    label: "Expired",
    variant: "destructive",
    icon: CircleXIcon,
  },
  disconnected: {
    label: "Not connected",
    variant: "outline",
    icon: UnplugIcon,
  },
}

function useCurrentTime(): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 30_000)
    return () => {
      window.clearInterval(timer)
    }
  }, [])

  return now
}

function ExpiryDetails({
  account,
  now,
}: {
  account: ServiceAccount
  now: number
}) {
  if (account.expiresAt === null) {
    return <span className="text-muted-foreground">Not available</span>
  }
  const expiresAtMs = account.expiresAt * 1000
  const relative = formatDistanceStrict(expiresAtMs, now, {
    addSuffix: true,
  })
  return (
    <span>
      {formatDateTime(expiresAtMs)}
      <span className="block text-xs text-muted-foreground">{relative}</span>
    </span>
  )
}

function ConnectedByDetails({ account }: { account: ServiceAccount }) {
  if (!account.connected || account.connectedAt === null) {
    return <span className="text-muted-foreground">Not connected</span>
  }
  const who =
    account.connectedBy === null
      ? `${account.providerArg} CLI`
      : (account.connectedBy.name ?? "Unknown user")
  return (
    <span>
      {who}
      <span className="block text-xs text-muted-foreground">
        {formatDateTime(account.connectedAt)}
      </span>
    </span>
  )
}

function ScopeDetails({ account }: { account: ServiceAccount }) {
  return (
    <div className="flex flex-wrap gap-1">
      {account.scopes.map((scope) => (
        <Badge key={scope} variant="outline" className="font-mono text-xs">
          {scope}
        </Badge>
      ))}
      {account.scopesGranted ? null : (
        <span className="block w-full text-xs text-muted-foreground">
          Requested — the provider did not report what it granted.
        </span>
      )}
    </div>
  )
}

function ServiceAccountCard({
  account,
  now,
  busy,
  onConnect,
  onRefresh,
  onDisconnect,
}: {
  account: ServiceAccount
  now: number
  busy: "connecting" | "refreshing" | "disconnecting" | null
  onConnect: () => void
  onRefresh: () => void
  onDisconnect: () => void
}) {
  const status = serviceAccountStatus(account.connected, account.expiresAt, now)
  const display = STATUS_DISPLAY[status]
  const StatusIcon = display.icon
  const canRefresh = account.connected && account.hasRefreshToken
  const anyBusy = busy !== null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{account.displayName}</CardTitle>
        <CardDescription>
          {account.service} OAuth service account
        </CardDescription>
        <CardAction>
          <Badge variant={display.variant}>
            <StatusIcon />
            {display.label}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground">
              Connected by
            </dt>
            <dd>
              <ConnectedByDetails account={account} />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground">
              Access token expiry
            </dt>
            <dd>
              <ExpiryDetails account={account} now={now} />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground">
              Refresh token
            </dt>
            <dd>{account.hasRefreshToken ? "Available" : "Not available"}</dd>
          </div>
          <div className="space-y-1 sm:col-span-3">
            <dt className="text-xs font-medium text-muted-foreground">
              Scopes
            </dt>
            <dd>
              <ScopeDetails account={account} />
            </dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {account.connected
            ? "Reconnect opens the provider's consent screen again; refresh only exchanges the stored refresh token."
            : `Connect opens ${account.displayName}'s consent screen. bun run auth ${account.providerArg} still works as a fallback.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {account.connected ? (
            <Button
              type="button"
              variant="outline"
              disabled={!canRefresh || anyBusy}
              onClick={onRefresh}
            >
              {busy === "refreshing" ? <Spinner /> : <RefreshCwIcon />}
              Refresh
            </Button>
          ) : null}
          <Button
            type="button"
            variant={account.connected ? "outline" : "default"}
            disabled={anyBusy}
            onClick={onConnect}
          >
            {busy === "connecting" ? <Spinner /> : <PlugIcon />}
            {account.connected ? "Reconnect" : "Connect"}
          </Button>
          {account.connected ? (
            <Button
              type="button"
              variant="destructive"
              disabled={anyBusy}
              onClick={onDisconnect}
            >
              {busy === "disconnecting" ? <Spinner /> : <UnplugIcon />}
              Disconnect
            </Button>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  )
}

export function AdminServiceAccountsPage() {
  const accounts = useQuery(
    api.integrations.tokensStore.listServiceAccounts,
    {}
  )
  const refreshServiceAccount = useAction(
    api.integrations.tokens.refreshServiceAccount
  )
  const startConnect = useMutation(
    api.integrations.serviceAccountConnect.startConnect
  )
  const disconnectServiceAccount = useMutation(
    api.integrations.tokensStore.disconnectServiceAccount
  )
  const [busy, setBusy] = useState<{
    service: string
    kind: "connecting" | "refreshing" | "disconnecting"
  } | null>(null)
  const [pendingDisconnect, setPendingDisconnect] =
    useState<ServiceAccount | null>(null)
  const now = useCurrentTime()

  if (accounts === undefined) {
    return <Page.Status variant="loading" message="Loading service accounts…" />
  }

  const connect = async (account: ServiceAccount) => {
    setBusy({ service: account.service, kind: "connecting" })
    try {
      const { authorizeUrl } = await startConnect({ service: account.service })
      // Full navigation: the provider's consent screen is a different origin.
      window.location.assign(authorizeUrl)
    } catch (error) {
      toast.error(unknownErrorMessage(error, { includeConvexError: true }))
      setBusy(null)
    }
  }

  const refresh = async (account: ServiceAccount) => {
    setBusy({ service: account.service, kind: "refreshing" })
    try {
      const result = await refreshServiceAccount({ service: account.service })
      if (result.success) {
        toast.success(`${account.displayName} refreshed successfully.`)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Could not refresh ${account.displayName}.`
      )
    } finally {
      setBusy(null)
    }
  }

  const disconnect = async (account: ServiceAccount) => {
    setBusy({ service: account.service, kind: "disconnecting" })
    try {
      await disconnectServiceAccount({ service: account.service })
      toast.success(`${account.displayName} disconnected.`)
    } catch (error) {
      toast.error(unknownErrorMessage(error, { includeConvexError: true }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">Service accounts</h2>
        <p className="text-sm text-muted-foreground">
          Connect, refresh, and disconnect the OAuth accounts the platform uses.
          Token values are never shown here.
        </p>
      </div>
      {accounts.map((account) => (
        <ServiceAccountCard
          key={account.service}
          account={account}
          now={now}
          busy={busy?.service === account.service ? busy.kind : null}
          onConnect={() => void connect(account)}
          onRefresh={() => void refresh(account)}
          onDisconnect={() => {
            setPendingDisconnect(account)
          }}
        />
      ))}
      <AlertDialog
        open={pendingDisconnect !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDisconnect(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect {pendingDisconnect?.displayName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The stored token is removed from Convex and every feature that
              uses {pendingDisconnect?.displayName} stops working until it is
              connected again. This does not revoke the access already granted
              at the provider.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDisconnect !== null) {
                  void disconnect(pendingDisconnect)
                }
                setPendingDisconnect(null)
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
