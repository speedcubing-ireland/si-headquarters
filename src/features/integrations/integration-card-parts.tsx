import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IntegrationStatusBadge } from "@/features/integrations/integration-status-badge"
import type { TaskIntegrationStatus } from "@/convex/integrations/taskIntegrations/validators"
import { cn } from "@/lib/utils"
import { TrashIcon } from "lucide-react"
import type { ReactNode } from "react"

export function IntegrationCardRoot({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <Card className={cn("col-span-full", className)}>{children}</Card>
}

export function IntegrationCardHeader({
  icon,
  title,
  status,
  statusLabel,
  children,
}: {
  icon: ReactNode
  title: string
  status?: TaskIntegrationStatus
  statusLabel?: string
  children?: ReactNode
}) {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        {icon}
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {status !== undefined ? (
          <IntegrationStatusBadge status={status} label={statusLabel} />
        ) : null}
        {children}
      </CardTitle>
    </CardHeader>
  )
}

export function IntegrationCardDeleteButton({
  disabled,
  onDelete,
}: {
  disabled?: boolean
  onDelete: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={disabled}
      onClick={onDelete}
    >
      <TrashIcon className="size-4 text-destructive" />
    </Button>
  )
}

export function IntegrationCardBody({ children }: { children: ReactNode }) {
  return <CardContent>{children}</CardContent>
}

export function IntegrationCardAlert({ children }: { children: ReactNode }) {
  return (
    <CardContent>
      <Alert>{children}</Alert>
    </CardContent>
  )
}

export function IntegrationCardAlertDescription({
  children,
}: {
  children: ReactNode
}) {
  return <AlertDescription>{children}</AlertDescription>
}

export function IntegrationCardActions({ children }: { children: ReactNode }) {
  return <CardFooter className="flex flex-wrap gap-2">{children}</CardFooter>
}
