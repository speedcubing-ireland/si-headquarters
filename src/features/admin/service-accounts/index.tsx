import { formatDistanceStrict } from "date-fns"
import { useAction, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  RefreshCwIcon,
  UnplugIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
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

function ServiceAccountCard({
  account,
  now,
  refreshing,
  onRefresh,
}: {
  account: ServiceAccount
  now: number
  refreshing: boolean
  onRefresh: () => void
}) {
  const status = serviceAccountStatus(account.connected, account.expiresAt, now)
  const display = STATUS_DISPLAY[status]
  const StatusIcon = display.icon
  const canRefresh = account.connected && account.hasRefreshToken

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
              Stored since
            </dt>
            <dd>
              {account.connectedAt === null
                ? "Not connected"
                : formatDateTime(account.connectedAt)}
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
        </dl>
      </CardContent>
      <CardFooter className="justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {canRefresh
            ? "Refresh requests a new access token from the provider."
            : `Reconnect with bun run auth ${account.providerArg}.`}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={!canRefresh || refreshing}
          onClick={onRefresh}
        >
          {refreshing ? <Spinner /> : <RefreshCwIcon />}
          Refresh
        </Button>
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
  const [refreshingService, setRefreshingService] = useState<string | null>(
    null
  )
  const now = useCurrentTime()

  if (accounts === undefined) {
    return <Page.Status variant="loading" message="Loading service accounts…" />
  }

  const refresh = async (account: ServiceAccount) => {
    setRefreshingService(account.service)
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
      setRefreshingService(null)
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">Service accounts</h2>
        <p className="text-sm text-muted-foreground">
          Monitor OAuth connections and manually test their refresh tokens.
          Token values are never shown here.
        </p>
      </div>
      {accounts.map((account) => (
        <ServiceAccountCard
          key={account.service}
          account={account}
          now={now}
          refreshing={refreshingService === account.service}
          onRefresh={() => void refresh(account)}
        />
      ))}
    </div>
  )
}
